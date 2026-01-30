import type { Config, ProductDetail, Session } from "./types";
import { requestEbag } from "./client";

export async function getProductById(
  config: Config,
  session: Session,
  productId: number,
): Promise<ProductDetail> {
  const result = await requestEbag<ProductDetail>(
    config,
    session,
    `/products/${productId}/json`,
  );
  return result.data;
}
