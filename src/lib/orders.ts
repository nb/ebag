import type {
  Cache,
  Config,
  OrderAmount,
  OrderDetail,
  OrderItem,
  OrderSummary,
  Session,
} from "./types";
import { loadCache, saveCache } from "./config";
import { requestEbag } from "./client";
import { describeOrderStatus, logUnknownOrderStatus } from "./order-status";

export async function getTimeSlots(
  config: Config,
  session: Session,
): Promise<Record<string, unknown>> {
  const result = await requestEbag<Record<string, unknown>>(
    config,
    session,
    "/orders/get-time-slots",
  );
  return result.data;
}

type OrderListApiResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: Record<string, unknown>[];
  years_choices?: number[];
  months_choices?: number[];
};

type OrderDetailApiResponse = {
  order?: Record<string, unknown>;
  grouped_items?: Array<Record<string, unknown>>;
  missing_items?: unknown[];
  addition_details?: Record<string, unknown>;
};

function toOrderAmount(
  value?: string,
  currency?: "EUR",
): OrderAmount | undefined {
  if (!value) return undefined;
  return currency ? { value, currency } : { value };
}

function normalizeDate(value?: string | null) {
  if (!value) return undefined;
  const isoMatch = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const ymdAlt = value.match(/(\d{4})[./](\d{2})[./](\d{2})/);
  if (ymdAlt) return `${ymdAlt[1]}-${ymdAlt[2]}-${ymdAlt[3]}`;
  const dmyMatch = value.match(/(\d{2})[./-](\d{2})[./-](\d{4})/);
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

function parseAmountToCents(value?: string) {
  if (!value) return undefined;
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.round(parsed * 100);
}

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

function flattenOrderDetails(detail: OrderDetail): OrderDetail[] {
  const additional = detail.additionalOrders || [];
  const flattened = [detail];
  for (const entry of additional) {
    flattened.push(...flattenOrderDetails(entry));
  }
  return flattened;
}

function getOrderPaidCents(order: OrderDetail, currency: "eur" | "local") {
  return currency === "eur"
    ? parseAmountToCents(order.totals.totalPaidEur ?? order.totals.totalEur)
    : parseAmountToCents(order.totals.totalPaid ?? order.totals.total);
}

export function resolveOrderAmount(
  order: OrderSummary | OrderDetail,
): OrderAmount | undefined {
  if ("totalPaidAllOrdersEur" in order && order.totalPaidAllOrdersEur) {
    return toOrderAmount(order.totalPaidAllOrdersEur, "EUR");
  }
  if ("totalPaidAllOrders" in order && order.totalPaidAllOrders) {
    return toOrderAmount(order.totalPaidAllOrders);
  }
  if ("finalAmountEur" in order && order.finalAmountEur) {
    return toOrderAmount(order.finalAmountEur, "EUR");
  }
  if ("finalAmount" in order && order.finalAmount) {
    return toOrderAmount(order.finalAmount);
  }
  if ("totals" in order) {
    if (order.totals.totalPaidAllOrdersEur) {
      return toOrderAmount(order.totals.totalPaidAllOrdersEur, "EUR");
    }
    if (order.totals.totalPaidAllOrders) {
      return toOrderAmount(order.totals.totalPaidAllOrders);
    }
    if (order.totals.totalPaidEur) {
      return toOrderAmount(order.totals.totalPaidEur, "EUR");
    }
    if (order.totals.totalEur) {
      return toOrderAmount(order.totals.totalEur, "EUR");
    }
    if (order.totals.totalPaid) {
      return toOrderAmount(order.totals.totalPaid);
    }
    if (order.totals.total) {
      return toOrderAmount(order.totals.total);
    }
  }
  return undefined;
}

export function resolveCombinedOrderDetailAmount(
  detail: OrderDetail,
): OrderAmount | undefined {
  if (detail.totals.totalPaidAllOrdersEur) {
    return toOrderAmount(detail.totals.totalPaidAllOrdersEur, "EUR");
  }
  if (detail.totals.totalPaidAllOrders) {
    return toOrderAmount(detail.totals.totalPaidAllOrders);
  }

  const orders = flattenOrderDetails(detail);

  let eurTotal = 0;
  let hasEur = true;
  for (const order of orders) {
    const cents = getOrderPaidCents(order, "eur");
    if (cents === undefined) {
      hasEur = false;
      break;
    }
    eurTotal += cents;
  }
  if (hasEur) {
    return toOrderAmount(formatCents(eurTotal), "EUR");
  }

  let localTotal = 0;
  let hasLocal = true;
  for (const order of orders) {
    const cents = getOrderPaidCents(order, "local");
    if (cents === undefined) {
      hasLocal = false;
      break;
    }
    localTotal += cents;
  }
  if (hasLocal) {
    return toOrderAmount(formatCents(localTotal));
  }

  return undefined;
}

function normalizeOrderSummary(entry: Record<string, unknown>): OrderSummary {
  const parseNumber = (value: unknown) => {
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      return Number.isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  };
  const orderId = entry.encrypted_id ? String(entry.encrypted_id) : "";
  const status = parseNumber(entry.order_status);
  logUnknownOrderStatus({
    status,
    orderId,
    source: "list",
  });
  return {
    id: orderId,
    shippingDate: entry.shipping_date ? String(entry.shipping_date) : undefined,
    timeSlotStart: parseNumber(entry.time_slot_start),
    timeSlotEnd: parseNumber(entry.time_slot_end),
    timeSlotDisplay: entry.time_slot_display
      ? String(entry.time_slot_display)
      : undefined,
    status,
    finalAmount: entry.final_amount ? String(entry.final_amount) : undefined,
    finalAmountEur: entry.final_amount_eur
      ? String(entry.final_amount_eur)
      : undefined,
    totalPaidAllOrders: entry.total_price_paid_all_orders
      ? String(entry.total_price_paid_all_orders)
      : undefined,
    totalPaidAllOrdersEur: entry.total_price_paid_all_orders_eur
      ? String(entry.total_price_paid_all_orders_eur)
      : undefined,
    additionalOrdersCount:
      typeof entry.additional_orders_count === "number"
        ? entry.additional_orders_count
        : entry.additional_orders_count !== undefined
          ? Number(entry.additional_orders_count)
          : undefined,
    phone: entry.phone ? String(entry.phone) : undefined,
  };
}

function normalizeGroupedItems(groupedItems: unknown): OrderItem[] {
  if (!Array.isArray(groupedItems)) return [];
  const items: OrderItem[] = [];
  for (const group of groupedItems) {
    if (!group || typeof group !== "object") continue;
    const groupName = (group as { group_name?: string }).group_name;
    const groupItems = (group as { group_items?: unknown[] }).group_items || [];
    for (const entry of groupItems) {
      if (!entry || typeof entry !== "object") continue;
      const item = entry as Record<string, unknown>;
      const product =
        (item.product as Record<string, unknown> | undefined) || undefined;
      const productSaved =
        (item.product_saved as Record<string, unknown> | undefined) ||
        undefined;
      const name =
        (product?.name as string | undefined) ||
        (item.product_saved_name as string | undefined) ||
        (productSaved?.name_bg as string | undefined) ||
        (productSaved?.name_en as string | undefined) ||
        "Unknown";
      const id =
        typeof product?.id === "number"
          ? product.id
          : product?.id
            ? Number(product.id)
            : typeof productSaved?.id === "number"
              ? productSaved.id
              : productSaved?.id
                ? Number(productSaved.id)
                : undefined;
      items.push({
        id,
        name,
        quantity: item.quantity ? String(item.quantity) : undefined,
        unit: product?.unit_weight_text
          ? String(product.unit_weight_text)
          : undefined,
        price: item.price ? String(item.price) : undefined,
        priceEur: item.price_eur ? String(item.price_eur) : undefined,
        regularPrice: item.regular_price
          ? String(item.regular_price)
          : undefined,
        regularPriceEur: item.regular_price_eur
          ? String(item.regular_price_eur)
          : undefined,
        group: groupName ? String(groupName) : undefined,
      });
    }
  }
  return items;
}

function normalizeOrderDetail(payload: OrderDetailApiResponse): OrderDetail {
  const order = payload.order || {};
  const parseNumber = (value: unknown) => {
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      return Number.isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  };
  const addressSerialized = order.address_serialized
    ? String(order.address_serialized)
    : "";
  const city = order.city ? String(order.city) : "";
  const neighbourhood = order.neighbourhood ? String(order.neighbourhood) : "";
  const street = order.street ? String(order.street) : "";
  const address =
    addressSerialized ||
    [city, neighbourhood, street].filter(Boolean).join(", ");

  const additionalOrdersRaw = Array.isArray(order.additional_orders)
    ? (order.additional_orders as OrderDetailApiResponse[])
    : [];

  const orderId = order.encrypted_id ? String(order.encrypted_id) : "";
  const status = parseNumber(order.order_status);
  logUnknownOrderStatus({
    status,
    orderId,
    source: "detail",
  });
  return {
    id: orderId,
    status,
    shippingDate: order.shipping_date ? String(order.shipping_date) : undefined,
    timeSlotDisplay: order.timeslot_display
      ? String(order.timeslot_display)
      : order.time_slot_display
        ? String(order.time_slot_display)
        : undefined,
    address: address || undefined,
    totals: {
      total: order.total ? String(order.total) : undefined,
      totalEur: order.total_eur ? String(order.total_eur) : undefined,
      totalPaid: order.total_price_paid
        ? String(order.total_price_paid)
        : undefined,
      totalPaidEur: order.total_price_paid_eur
        ? String(order.total_price_paid_eur)
        : undefined,
      totalPaidAllOrders: order.total_price_paid_all_orders
        ? String(order.total_price_paid_all_orders)
        : undefined,
      totalPaidAllOrdersEur: order.total_price_paid_all_orders_eur
        ? String(order.total_price_paid_all_orders_eur)
        : undefined,
      discount: order.discount ? String(order.discount) : undefined,
      discountEur: order.discount_eur ? String(order.discount_eur) : undefined,
      tip: order.tip ? String(order.tip) : undefined,
      tipEur: order.tip_eur ? String(order.tip_eur) : undefined,
    },
    items: normalizeGroupedItems(payload.grouped_items),
    additionalOrders: additionalOrdersRaw.length
      ? additionalOrdersRaw.map((entry) => normalizeOrderDetail(entry))
      : undefined,
  };
}

function addStatusDescription(order: OrderSummary): OrderSummary {
  return {
    ...order,
    statusDescription: describeOrderStatus(order.status),
  };
}

function addDetailStatusDescription(detail: OrderDetail): OrderDetail {
  return {
    ...detail,
    statusDescription: describeOrderStatus(detail.status),
    additionalOrders: detail.additionalOrders
      ? detail.additionalOrders.map((entry) =>
          addDetailStatusDescription(entry),
        )
      : undefined,
  };
}

function filterByDate(
  orders: OrderSummary[],
  from?: string,
  to?: string,
): OrderSummary[] {
  if (!from && !to) return orders;
  return orders.filter((order) => {
    const date = order.shippingDate;
    if (!date) return false;
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  });
}

export async function listOrders(
  config: Config,
  session: Session,
  options: { limit?: number; page?: number; from?: string; to?: string } = {},
): Promise<{
  count: number;
  results: OrderSummary[];
  next: string | null;
  previous: string | null;
}> {
  const limit = options.limit ?? 10;
  const from = normalizeDate(options.from);
  const to = normalizeDate(options.to);
  const hasRange = Boolean(from || to);
  const results: OrderSummary[] = [];
  let next: string | null = null;
  let previous: string | null = null;
  const maxPages = options.page ? 1 : hasRange ? 200 : 20;

  const years: number[] = [];
  if (from && to) {
    const start = Number(from.slice(0, 4));
    const end = Number(to.slice(0, 4));
    for (let year = start; year <= end; year += 1) years.push(year);
  } else if (from) {
    const start = Number(from.slice(0, 4));
    const currentYear = new Date().getFullYear();
    for (let year = start; year <= currentYear; year += 1) years.push(year);
  } else if (to) {
    const end = Number(to.slice(0, 4));
    const currentYear = new Date().getFullYear();
    for (let year = end; year <= currentYear; year += 1) years.push(year);
  } else {
    years.push(new Date().getFullYear());
  }

  const fetchYears = hasRange ? years : [new Date().getFullYear()];
  for (const year of fetchYears) {
    let page = options.page ?? 1;
    let pagesFetched = 0;
    while (results.length < limit) {
      const result = await requestEbag<OrderListApiResponse>(
        config,
        session,
        "/orders/list/json",
        {
          query: {
            page,
            year: hasRange ? year : undefined,
            exclude_additional_order: "true",
          },
        },
      );
      const payload = result.data;
      next = payload.next ?? null;
      previous = payload.previous ?? null;
      const normalized = payload.results.map(normalizeOrderSummary);
      const filtered = filterByDate(normalized, from, to);
      results.push(...filtered.map(addStatusDescription));

      pagesFetched += 1;
      if (!payload.next || pagesFetched >= maxPages) {
        break;
      }
      if (from) {
        const lastDate = normalized[normalized.length - 1]?.shippingDate;
        if (lastDate && lastDate < from) {
          break;
        }
      }
      page += 1;
    }
    if (results.length >= limit) break;
  }

  return {
    count: results.slice(0, limit).length,
    results: results.slice(0, limit),
    next,
    previous,
  };
}

function getCachedOrder(cache: Cache, orderId: string) {
  return cache.orders?.[orderId];
}

export async function getOrderDetail(
  config: Config,
  session: Session,
  orderId: string,
): Promise<OrderDetail> {
  const cache = loadCache();
  const cached = getCachedOrder(cache, orderId);
  if (cached && cached.status === 4) {
    return addDetailStatusDescription(cached.detail);
  }

  const result = await requestEbag<OrderDetailApiResponse>(
    config,
    session,
    `/orders/${orderId}/details/json`,
  );
  const detail = normalizeOrderDetail(result.data);
  const detailWithDescription = addDetailStatusDescription(detail);

  if (!cache.orders) {
    cache.orders = {};
  }
  if (detail.status === 4) {
    cache.orders[orderId] = {
      status: detail.status,
      updatedAt: new Date().toISOString(),
      detail,
    };
    saveCache(cache);
  }

  return detailWithDescription;
}
