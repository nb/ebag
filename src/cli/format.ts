import type {
  OrderDetail,
  OrderItem,
  OrderSummary,
  ProductSummary,
} from "../lib/types";

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
  return "";
}

export function outputProducts(products: ProductSummary[]) {
  for (const product of products) {
    const price = formatPrice(product);
    let source = "";
    if (product.source === "list") {
      const listNames = (product.listNames || []).filter(Boolean);
      if (listNames.length) {
        source = ` [${listNames.join(", ")}]`;
      }
    }
    const line = `${product.id} ${product.name}${price ? ` - ${price}` : ""}${source}`;
    process.stdout.write(`${line}\n`);
  }
}

export function outputList(
  items: { id: number; name: string; count?: number }[],
) {
  for (const item of items) {
    const count = item.count !== undefined ? ` (${item.count})` : "";
    process.stdout.write(`${item.id} ${item.name}${count}\n`);
  }
}

export function outputProductDetail(data: Record<string, unknown>) {
  const id = data.id ? String(data.id) : "";
  const name = data.name ? String(data.name) : "";
  const nameEn = data.name_en ? String(data.name_en) : "";
  const brand =
    typeof data.brand === "string"
      ? data.brand
      : (
          data.brand as
            | { name?: string; name_bg?: string; name_en?: string }
            | undefined
        )?.name ||
        (
          data.brand as
            | { name?: string; name_bg?: string; name_en?: string }
            | undefined
        )?.name_bg ||
        (
          data.brand as
            | { name?: string; name_bg?: string; name_en?: string }
            | undefined
        )?.name_en ||
        "";
  const unit = data.unit_weight_text ? String(data.unit_weight_text) : "";
  const price =
    data.current_price_eur ?? data.price_promo_eur ?? data.price_eur;
  const priceText = price ? String(price) : "";
  const currency = priceText ? "EUR" : "";
  const availability =
    data.is_available === false
      ? "No"
      : data.is_available === true
        ? "Yes"
        : "";
  const urlSlug = data.url_slug ? String(data.url_slug) : "";
  const origin = data.country_of_origin ? String(data.country_of_origin) : "";
  const expiryRaw = data.expiry_date ? String(data.expiry_date) : "";
  const expiry = formatDate(expiryRaw);
  const description = data.description ? String(data.description) : "";

  const kvPairs = [
    ["ID", id],
    ["Brand", brand],
    ["Unit", unit],
    ["Price", priceText ? `${priceText}${currency ? ` ${currency}` : ""}` : ""],
    ["Available", availability],
    ["Origin", origin],
    ["Expiry", expiry],
    ["Slug", urlSlug],
  ];

  const energyPairs = formatEnergyValues(data.energy_values);
  const kvLines = [...kvPairs.filter(([, value]) => value), ...energyPairs].map(
    ([key, value]) => `${key}: ${value}`,
  );

  const headerLines = [
    `# ${name || "Product"}`,
    nameEn ? `*${nameEn}*` : "",
  ].filter(Boolean);
  const descriptionMd = description ? htmlToMarkdown(description) : "";
  const { descriptionText, ingredientsText } = splitIngredients(descriptionMd);
  const descriptionBlock = descriptionText
    ? `# Description\n\n${descriptionText}`
    : "";
  const ingredientsBlock = ingredientsText
    ? `\n# Ingredients\n\n${ingredientsText}`
    : "";

  const kvBlock = kvLines.length ? ["---", ...kvLines, "---"].join("\n") : "";
  const output = [
    headerLines.join("\n"),
    kvBlock,
    descriptionBlock,
    ingredientsBlock,
  ]
    .filter(Boolean)
    .join("\n");

  process.stdout.write(`${output}\n`);
}

function formatOrderAmount(order: OrderSummary | OrderDetail) {
  if ("finalAmountEur" in order && order.finalAmountEur) {
    return `${order.finalAmountEur} EUR`;
  }
  if ("finalAmount" in order && order.finalAmount) {
    return order.finalAmount;
  }
  if ("totals" in order) {
    if (order.totals.totalPaidEur) return `${order.totals.totalPaidEur} EUR`;
    if (order.totals.totalEur) return `${order.totals.totalEur} EUR`;
    if (order.totals.totalPaid) return order.totals.totalPaid;
    if (order.totals.total) return order.totals.total;
  }
  return "";
}

function formatDateInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const lookup = new Map(parts.map((part) => [part.type, part.value]));
  const year = lookup.get("year") || "";
  const month = lookup.get("month") || "";
  const day = lookup.get("day") || "";
  return `${year}-${month}-${day}`;
}

const ORDER_STATUS_LABELS: Record<number, string> = {
  0: "Нова",
  3: "Отказана",
  4: "Завършена",
};

function formatOrderStatus(order: OrderSummary | OrderDetail) {
  const status = order.status;
  if (status === undefined) return "";
  const label = ORDER_STATUS_LABELS[status];
  if (label) return label;
  return `Status ${status}`;
}

export function outputOrdersList(orders: OrderSummary[]) {
  for (const order of orders) {
    const date = order.shippingDate ? formatDate(order.shippingDate) : "";
    const slot = order.timeSlotDisplay || "";
    const status = formatOrderStatus(order);
    const total = formatOrderAmount(order);
    const parts = [order.id, date, slot].filter(Boolean);
    const suffix = [status, total].filter(Boolean).join(" - ");
    const line = `${parts.join(" ")}${suffix ? ` - ${suffix}` : ""}`;
    process.stdout.write(`${line}\n`);
  }
}

function outputOrderItems(items: OrderItem[]) {
  const byGroup = new Map<string, OrderItem[]>();
  const ungrouped: OrderItem[] = [];
  for (const item of items) {
    if (item.group) {
      const groupItems = byGroup.get(item.group) || [];
      groupItems.push(item);
      byGroup.set(item.group, groupItems);
    } else {
      ungrouped.push(item);
    }
  }

  const groupEntries = [...byGroup.entries()];
  if (groupEntries.length) {
    for (const [group, groupItems] of groupEntries) {
      process.stdout.write(`## ${group}\n`);
      for (const item of groupItems) {
        const qty = item.quantity ? ` x${item.quantity}` : "";
        const unit = item.unit ? ` (${item.unit})` : "";
        const price = item.priceEur ? `${item.priceEur} EUR` : item.price || "";
        const line = `- ${item.name}${unit}${qty}${price ? ` - ${price}` : ""}`;
        process.stdout.write(`${line}\n`);
      }
      process.stdout.write("\n");
    }
  }

  if (ungrouped.length) {
    for (const item of ungrouped) {
      const qty = item.quantity ? ` x${item.quantity}` : "";
      const unit = item.unit ? ` (${item.unit})` : "";
      const price = item.priceEur ? `${item.priceEur} EUR` : item.price || "";
      const line = `- ${item.name}${unit}${qty}${price ? ` - ${price}` : ""}`;
      process.stdout.write(`${line}\n`);
    }
    process.stdout.write("\n");
  }
}

export function outputOrderDetail(detail: OrderDetail) {
  const header = `# Order ${detail.id || ""}`.trim();
  const status = formatOrderStatus(detail);
  const date = detail.shippingDate ? formatDate(detail.shippingDate) : "";
  const address = detail.address || "";
  const total = formatOrderAmount(detail);
  const kvPairs = [
    ["ID", detail.id],
    ["Status", status],
    ["Date", date],
    ["Timeslot", detail.timeSlotDisplay || ""],
    ["Address", address],
    ["Total", total],
    [
      "Discount",
      detail.totals.discountEur
        ? `${detail.totals.discountEur} EUR`
        : detail.totals.discount || "",
    ],
    [
      "Tip",
      detail.totals.tipEur
        ? `${detail.totals.tipEur} EUR`
        : detail.totals.tip || "",
    ],
  ].filter(([, value]) => value);
  const kvLines = kvPairs.map(([key, value]) => `${key}: ${value}`);
  const kvBlock = kvLines.length ? ["---", ...kvLines, "---"].join("\n") : "";

  process.stdout.write(`${header}\n`);
  if (kvBlock) {
    process.stdout.write(`${kvBlock}\n`);
  }

  process.stdout.write("# Items\n");
  if (detail.items.length) {
    outputOrderItems(detail.items);
  } else {
    process.stdout.write("No items found.\n\n");
  }

  if (detail.additionalOrders && detail.additionalOrders.length) {
    process.stdout.write("# Additional Orders\n");
    for (const additional of detail.additionalOrders) {
      process.stdout.write(`## Order ${additional.id}\n`);
      const additionalTotal = formatOrderAmount(additional);
      if (additionalTotal) {
        process.stdout.write(`Total: ${additionalTotal}\n`);
      }
      if (additional.items.length) {
        outputOrderItems(additional.items);
      } else {
        process.stdout.write("No items found.\n\n");
      }
    }
  }
}

function formatDate(value: string) {
  if (!value) return "";
  const isoMatch = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const ymdAlt = value.match(/(\d{4})[./](\d{2})[./](\d{2})/);
  if (ymdAlt) return `${ymdAlt[1]}-${ymdAlt[2]}-${ymdAlt[3]}`;
  const dmyMatch = value.match(/(\d{2})[./-](\d{2})[./-](\d{4})/);
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

function formatEnergyValues(value: unknown): Array<[string, string]> {
  if (!value) return [];
  if (Array.isArray(value)) {
    const pairs: Array<[string, string]> = [];
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
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
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== null && entry !== undefined)
      .flatMap(([key, entry]) =>
        splitEnergyValues(`Energy ${key}`, String(entry)),
      );
  }
  return [];
}

function splitEnergyValues(
  label: string,
  raw: string,
): Array<[string, string]> {
  const normalized = normalizeNumberString(raw);
  const kcalMatch = normalized.match(/(\d+(?:\.\d+)?)\s*kcal/i);
  const kjMatch = normalized.match(/(\d+(?:\.\d+)?)\s*kJ/i);
  const hasKcalKjLabel = /kcal/i.test(label) && /kJ/i.test(label);
  const splitMatch = normalized.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  const baseLabel = label.replace(/\(?\s*kcal\s*\/\s*kJ\s*\)?/i, "").trim();
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
  if (typeof value === "number") return value.toString();
  if (typeof value !== "string") return String(value);
  const trimmed = value.trim().replace(/\u00a0/g, " ");
  const noSpaces = trimmed.replace(/\s+/g, "");
  if (noSpaces.includes(",")) {
    return noSpaces.replace(",", ".");
  }
  return noSpaces;
}

function htmlToMarkdown(html: string) {
  let text = html;
  text = text.replace(/<\s*br\s*\/?\s*>/gi, "\n");
  text = text.replace(/<\s*\/p\s*>/gi, "\n\n");
  text = text.replace(/<\s*p[^>]*>/gi, "");
  text = text.replace(/<\s*li[^>]*>/gi, "- ");
  text = text.replace(/<\s*\/li\s*>/gi, "\n");
  text = text.replace(/<\s*ul[^>]*>/gi, "\n");
  text = text.replace(/<\s*\/ul\s*>/gi, "\n");
  text = text.replace(/<[^>]+>/g, "");
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

function splitIngredients(text: string) {
  if (!text) return { descriptionText: "", ingredientsText: "" };
  const match = text.match(/(?:^|\n)\s*Съставки\s*:?\s*/i);
  if (!match || match.index === undefined) {
    return { descriptionText: text, ingredientsText: "" };
  }
  const start = match.index;
  const end = start + match[0].length;
  const descriptionText = text.slice(0, start).trim();
  const ingredientsText = text.slice(end).trim();
  return { descriptionText, ingredientsText };
}
