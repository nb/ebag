import type { ProductSummary } from '../lib/types';

export function outputJson(data: unknown) {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

function formatPrice(product: ProductSummary) {
  if (product.currentPrice) return product.currentPrice;
  if (product.pricePromo) return product.pricePromo;
  if (product.price) return product.price;
  return '';
}

export function outputProducts(products: ProductSummary[]) {
  for (const product of products) {
    const price = formatPrice(product);
    let source = '';
    if (product.source === 'list') {
      const listNames = (product.listNames || []).filter(Boolean);
      if (listNames.length) {
        source = ` [${listNames.join(', ')}]`;
      }
    }
    const line = `${product.id} ${product.name}${price ? ` - ${price}` : ''}${source}`;
    process.stdout.write(`${line}\n`);
  }
}

export function outputList(items: { id: number; name: string; count?: number }[]) {
  for (const item of items) {
    const count = item.count !== undefined ? ` (${item.count})` : '';
    process.stdout.write(`${item.id} ${item.name}${count}\n`);
  }
}
