import type { Config, Session } from "./types";
import { requestEbag } from "./client";

export async function addToCart(
  config: Config,
  session: Session,
  productId: number,
  quantity: number,
  unitTypeOverride = "false",
) {
  const baseUrl = config.baseUrl || "https://www.ebag.bg";
  const body = new URLSearchParams({
    product_id: String(productId),
    quantity: String(quantity),
    unit_type_override: unitTypeOverride,
  });

  const result = await requestEbag(config, session, "/cart/add", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      origin: baseUrl,
      referer: `${baseUrl}/search/`,
    },
    body,
  });

  return result.data;
}

export async function updateCart(
  config: Config,
  session: Session,
  productId: number,
  quantity: number,
  unitTypeOverride = "false",
) {
  const baseUrl = config.baseUrl || "https://www.ebag.bg";
  const body = new URLSearchParams({
    product_id: String(productId),
    quantity: String(quantity),
    unit_type_override: unitTypeOverride,
  });

  const result = await requestEbag(config, session, "/cart/update", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      origin: baseUrl,
      referer: `${baseUrl}/search/`,
    },
    body,
  });

  return result.data;
}

export async function getCart(config: Config, session: Session) {
  const result = await requestEbag(config, session, "/cart/json");
  return result.data;
}
