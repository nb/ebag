import type { OrderDetail, OrderSummary } from "../lib/types";
import { isKnownOrderStatus } from "../lib/order-status";

const ISSUE_URL = "https://github.com/nb/ebag/issues";

export function warnUnknownOrderStatuses(
  orders: Array<OrderSummary | OrderDetail>,
) {
  for (const order of orders) {
    const status = order.status;
    if (isKnownOrderStatus(status) || status === undefined) continue;
    const orderId = order.id ? ` for order ${order.id}` : "";
    process.stderr.write(
      `Warning: Unknown order status${orderId}. Please check this order on the website and file a GitHub issue so we can update the status mapping: ${ISSUE_URL}\n`,
    );
  }
}
