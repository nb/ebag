import { appendLog } from "./log";

const ORDER_STATUS_LABELS: Record<number, string> = {
  0: "Нова",
  3: "Отказана",
  4: "Завършена",
};

const KNOWN_ORDER_STATUSES = new Set(
  Object.keys(ORDER_STATUS_LABELS).map(Number),
);

type OrderStatusContext = {
  status?: number;
  orderId?: string;
  source: "list" | "detail";
};

export function isKnownOrderStatus(status?: number) {
  return status !== undefined && KNOWN_ORDER_STATUSES.has(status);
}

export function describeOrderStatus(status?: number) {
  if (status === undefined) return "";
  const label = ORDER_STATUS_LABELS[status];
  if (label) return label;
  return `Status ${status}`;
}

export function logUnknownOrderStatus({
  status,
  orderId,
  source,
}: OrderStatusContext) {
  if (status === undefined || isKnownOrderStatus(status)) return;
  appendLog({
    event: "order_status_unknown",
    level: "info",
    status,
    orderId,
    source,
  });
}
