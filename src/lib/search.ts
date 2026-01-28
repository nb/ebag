import type { Cache, Config, ProductCacheEntry, ProductSummary, SearchResult, Session } from './types';
import { loadCache, saveCache } from './config';
import { requestAlgolia, requestEbag } from './client';
import { getLists } from './lists';

const DEFAULT_FACETS = [
  'brand_name_bg',
  'country_of_origin_bg',
  'hierarchical_categories_bg.lv1',
];

export const PRODUCT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export function isProductCacheFresh(
  entry: ProductCacheEntry,
  now: number = Date.now(),
  ttlMs: number = PRODUCT_CACHE_TTL_MS,
) {
  const cachedAt = Date.parse(entry.cachedAt);
  if (!Number.isFinite(cachedAt)) return false;
  return now - cachedAt < ttlMs;
}

function normalizeProductFromDetail(data: Record<string, unknown>): ProductSummary {
  const id = Number(data.id);
  const name = String(data.name || '');
  const nameEn = data.name_en ? String(data.name_en) : undefined;
  const price = data.price ? String(data.price) : undefined;
  const pricePromo = data.price_promo ? String(data.price_promo) : undefined;
  const currentPrice = data.current_price ? String(data.current_price) : undefined;
  const mainImageId = data.main_image_id ? String(data.main_image_id) : undefined;
  const imageUrl = mainImageId
    ? `https://www.ebag.bg/products/images/${mainImageId}/200/webp`
    : undefined;
  const urlSlug = data.url_slug ? String(data.url_slug) : undefined;

  return {
    id,
    name,
    nameEn,
    price,
    pricePromo,
    currentPrice,
    imageUrl,
    urlSlug,
  };
}

function normalizeProductFromAlgolia(hit: Record<string, unknown>): ProductSummary {
  const id = Number(hit.id);
  const name = String(hit.name_bg || '');
  const nameEn = hit.name_en ? String(hit.name_en) : undefined;
  const price = hit.price ? String(hit.price) : undefined;
  const pricePromo = hit.price_promo ? String(hit.price_promo) : undefined;
  const currentPrice = hit.current_price ? String(hit.current_price) : undefined;
  const imageUrl = hit.product_image_absolute_url
    ? String(hit.product_image_absolute_url)
    : undefined;
  const urlSlug = hit.url_slug_bg ? String(hit.url_slug_bg) : undefined;

  return {
    id,
    name,
    nameEn,
    price,
    pricePromo,
    currentPrice,
    imageUrl,
    urlSlug,
    source: 'algolia',
  };
}

function safeLower(value: string) {
  return value.toLocaleLowerCase('bg-BG');
}

async function fetchProductDetail(
  config: Config,
  session: Session,
  productId: number,
): Promise<ProductSummary> {
  const result = await requestEbag<Record<string, unknown>>(
    config,
    session,
    `/products/${productId}/json`,
  );
  return normalizeProductFromDetail(result.data);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      results.push(await mapper(current));
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

async function getProductWithCache(
  config: Config,
  session: Session,
  cache: Cache,
  productId: number,
) {
  const cached = cache.products[String(productId)];
  if (cached) {
    if ('product' in cached) {
      const entry = cached as ProductCacheEntry;
      if (isProductCacheFresh(entry)) {
        return entry.product;
      }
    }
  }

  const product = await fetchProductDetail(config, session, productId);
  cache.products[String(productId)] = {
    product,
    cachedAt: new Date().toISOString(),
  };
  return product;
}

async function searchInLists(
  config: Config,
  session: Session,
  query: string,
): Promise<ProductSummary[]> {
  if (!session.cookies) {
    return [];
  }

  const lists = await getLists(config, session);
  const productIdToLists = new Map<number, string[]>();

  for (const list of lists) {
    for (const product of list.products || []) {
      const existing = productIdToLists.get(product.productId) || [];
      existing.push(list.name);
      productIdToLists.set(product.productId, existing);
    }
  }

  const cache = loadCache();
  const products = await mapWithConcurrency(
    [...productIdToLists.keys()],
    5,
    async (productId) => getProductWithCache(config, session, cache, productId),
  );

  cache.updatedAt = new Date().toISOString();
  saveCache(cache);

  const needle = safeLower(query);
  return products
    .map((product) => ({
      ...product,
      source: 'list' as const,
      listNames: productIdToLists.get(product.id) || [],
    }))
    .filter((product) => {
      const name = safeLower(product.name || '');
      const nameEn = product.nameEn ? safeLower(product.nameEn) : '';
      return name.includes(needle) || nameEn.includes(needle);
    });
}

async function searchAlgolia(
  config: Config,
  query: string,
  page: number,
  hitsPerPage: number,
): Promise<ProductSummary[]> {
  const params = new URLSearchParams({
    clickAnalytics: 'true',
    facets: JSON.stringify(DEFAULT_FACETS),
    filters: '',
    highlightPostTag: '__/ais-highlight__',
    highlightPreTag: '__ais-highlight__',
    maxValuesPerFacet: '50',
    page: String(page),
    query,
    hitsPerPage: String(hitsPerPage),
  });

  const body = {
    requests: [
      {
        indexName: 'products',
        params: params.toString(),
      },
    ],
  };

  const result = await requestAlgolia<{ results: Array<{ hits: Record<string, unknown>[] }> }>(
    config,
    body,
  );

  const hits = result.data.results?.[0]?.hits || [];
  return hits.map(normalizeProductFromAlgolia);
}

export async function searchProducts(
  config: Config,
  session: Session,
  query: string,
  options: { page?: number; limit?: number } = {},
): Promise<SearchResult> {
  const page = options.page ?? 0;
  const limit = options.limit ?? 20;
  const localResults = await searchInLists(config, session, query);

  const hitsPerPage = Math.max(limit, 20);
  const remoteResults = await searchAlgolia(config, query, page, hitsPerPage);

  const merged = [...localResults];
  const seen = new Set(localResults.map((p) => p.id));
  for (const item of remoteResults) {
    if (!seen.has(item.id)) {
      merged.push(item);
      seen.add(item.id);
    }
  }

  return {
    query,
    results: merged.slice(0, limit),
    sourceCounts: {
      list: localResults.length,
      algolia: remoteResults.length,
    },
  };
}
