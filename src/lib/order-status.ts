import { appendLog } from "./log";

const KNOWN_ORDER_STATUSES = new Set([0, 3, 4]);

type OrderStatusContext = {
  status?: number;
  statusText?: string | null;
  orderId?: string;
  source: "list" | "detail";
};

export function isKnownOrderStatus(status?: number) {
  return status !== undefined && KNOWN_ORDER_STATUSES.has(status);
}

export function logUnknownOrderStatus({
  status,
  statusText,
  orderId,
  source,
}: OrderStatusContext) {
  if (status === undefined || isKnownOrderStatus(status)) return;
  appendLog({
    event: "order_status_unknown",
    level: "info",
    status,
    statusText: statusText ?? undefined,
    orderId,
    source,
  });
}
