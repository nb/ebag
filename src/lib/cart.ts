import type { Config, Session } from './types';
import { requestEbag } from './client';

export async function addToCart(
  config: Config,
  session: Session,
  productId: number,
  quantity: number,
  unitTypeOverride = 'false',
) {
  const body = new URLSearchParams({
    product_id: String(productId),
    quantity: String(quantity),
    unit_type_override: unitTypeOverride,
  });

  const result = await requestEbag(config, session, '/cart/add', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
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
  unitTypeOverride = 'false',
) {
  const body = new URLSearchParams({
    product_id: String(productId),
    quantity: String(quantity),
    unit_type_override: unitTypeOverride,
  });

  const result = await requestEbag(config, session, '/cart/update', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body,
  });

  return result.data;
}
