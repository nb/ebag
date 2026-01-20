import type { ProductSummary } from '../lib/types';

export function outputJson(data: unknown) {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

export function formatHeading(text: string) {
  if (process.stdout.isTTY && !process.env.NO_COLOR) {
    return `\u001b[1m${text}\u001b[0m`;
  }
  return text;
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

export function outputProductDetail(data: Record<string, unknown>) {
  const id = data.id ? String(data.id) : '';
  const name = data.name ? String(data.name) : '';
  const nameEn = data.name_en ? String(data.name_en) : '';
  const brand =
    typeof data.brand === 'string'
      ? data.brand
      : (data.brand as { name?: string; name_bg?: string; name_en?: string } | undefined)?.name ||
        (data.brand as { name?: string; name_bg?: string; name_en?: string } | undefined)
          ?.name_bg ||
        (data.brand as { name?: string; name_bg?: string; name_en?: string } | undefined)
          ?.name_en ||
        '';
  const unit = data.unit_weight_text ? String(data.unit_weight_text) : '';
  const price = data.current_price_eur ?? data.price_promo_eur ?? data.price_eur;
  const priceText = price ? String(price) : '';
  const currency = priceText ? 'EUR' : '';
  const availability =
    data.is_available === false ? 'No' : data.is_available === true ? 'Yes' : '';
  const urlSlug = data.url_slug ? String(data.url_slug) : '';
  const origin = data.country_of_origin ? String(data.country_of_origin) : '';
  const expiryRaw = data.expiry_date ? String(data.expiry_date) : '';
  const expiry = formatDate(expiryRaw);
  const description = data.description ? String(data.description) : '';

  const kvPairs = [
    ['ID', id],
    ['Brand', brand],
    ['Unit', unit],
    ['Price', priceText ? `${priceText}${currency ? ` ${currency}` : ''}` : ''],
    ['Available', availability],
    ['Origin', origin],
    ['Expiry', expiry],
    ['Slug', urlSlug],
  ];

  const energyPairs = formatEnergyValues(data.energy_values);
  const kvLines = [
    ...kvPairs.filter(([, value]) => value),
    ...energyPairs,
  ].map(([key, value]) => `${key}: ${value}`);

  const headerLines = [`# ${name || 'Product'}`, nameEn ? `*${nameEn}*` : ''].filter(Boolean);
  const descriptionMd = description ? htmlToMarkdown(description) : '';
  const { descriptionText, ingredientsText } = splitIngredients(descriptionMd);
  const descriptionBlock = descriptionText ? `# Description\n\n${descriptionText}` : '';
  const ingredientsBlock = ingredientsText ? `\n# Ingredients\n\n${ingredientsText}` : '';

  const kvBlock = kvLines.length ? ['---', ...kvLines, '---'].join('\n') : '';
  const output = [headerLines.join('\n'), kvBlock, descriptionBlock, ingredientsBlock]
    .filter(Boolean)
    .join('\n');

  process.stdout.write(`${output}\n`);
}

function formatDate(value: string) {
  if (!value) return '';
  const isoMatch = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const ymdAlt = value.match(/(\d{4})[./](\d{2})[./](\d{2})/);
  if (ymdAlt) return `${ymdAlt[1]}-${ymdAlt[2]}-${ymdAlt[3]}`;
  const dmyMatch = value.match(/(\d{2})[./-](\d{2})[./-](\d{4})/);
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

function formatEnergyValues(value: unknown): Array<[string, string]> {
  if (!value) return [];
  if (Array.isArray(value)) {
    const pairs: Array<[string, string]> = [];
    for (const item of value) {
      if (!item || typeof item !== 'object') continue;
      const entry = item as Record<string, unknown>;
      const label =
        (entry.name_bg as string | undefined) ||
        (entry.name_en as string | undefined) ||
        (entry.name as string | undefined);
      const amount =
        entry.value ??
        entry.amount ??
        entry.quantity ??
        entry.value_bg ??
        entry.value_en ??
        entry.energy;
      if (!label || amount === undefined || amount === null) continue;
      pairs.push(...splitEnergyValues(`Energy ${label}`, String(amount)));
    }
    return pairs;
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== null && entry !== undefined)
      .flatMap(([key, entry]) => splitEnergyValues(`Energy ${key}`, String(entry)));
  }
  return [];
}

function splitEnergyValues(label: string, raw: string): Array<[string, string]> {
  const normalized = normalizeNumberString(raw);
  const kcalMatch = normalized.match(/(\d+(?:\.\d+)?)\s*kcal/i);
  const kjMatch = normalized.match(/(\d+(?:\.\d+)?)\s*kJ/i);
  const hasKcalKjLabel = /kcal/i.test(label) && /kJ/i.test(label);
  const splitMatch = normalized.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  const baseLabel = label.replace(/\(?\s*kcal\s*\/\s*kJ\s*\)?/i, '').trim();
  const energyLabel = baseLabel || label;
  if (kcalMatch || kjMatch) {
    const items: Array<[string, string]> = [];
    if (kcalMatch) items.push([`${energyLabel} kcal`, kcalMatch[1]]);
    if (kjMatch) items.push([`${energyLabel} kJ`, kjMatch[1]]);
    return items;
  }
  if (splitMatch && hasKcalKjLabel) {
    return [
      [`${energyLabel} kcal`, splitMatch[1]],
      [`${energyLabel} kJ`, splitMatch[2]],
    ];
  }
  return [[label, normalized]];
}

function normalizeNumberString(value: unknown) {
  if (typeof value === 'number') return value.toString();
  if (typeof value !== 'string') return String(value);
  const trimmed = value.trim().replace(/\u00a0/g, ' ');
  const noSpaces = trimmed.replace(/\s+/g, '');
  if (noSpaces.includes(',')) {
    return noSpaces.replace(',', '.');
  }
  return noSpaces;
}

function htmlToMarkdown(html: string) {
  let text = html;
  text = text.replace(/<\s*br\s*\/?\s*>/gi, '\n');
  text = text.replace(/<\s*\/p\s*>/gi, '\n\n');
  text = text.replace(/<\s*p[^>]*>/gi, '');
  text = text.replace(/<\s*li[^>]*>/gi, '- ');
  text = text.replace(/<\s*\/li\s*>/gi, '\n');
  text = text.replace(/<\s*ul[^>]*>/gi, '\n');
  text = text.replace(/<\s*\/ul\s*>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

function splitIngredients(text: string) {
  if (!text) return { descriptionText: '', ingredientsText: '' };
  const match = text.match(/(?:^|\n)\s*Съставки\s*:?\s*/i);
  if (!match || match.index === undefined) {
    return { descriptionText: text, ingredientsText: '' };
  }
  const start = match.index;
  const end = start + match[0].length;
  const descriptionText = text.slice(0, start).trim();
  const ingredientsText = text.slice(end).trim();
  return { descriptionText, ingredientsText };
}
