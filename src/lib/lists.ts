import type { Config, ListSummary, Session } from './types';
import { requestEbag } from './client';

export async function getLists(config: Config, session: Session): Promise<ListSummary[]> {
  const result = await requestEbag<ListSummary[]>(config, session, '/lists/json');
  return result.data.map((list) => ({
    id: list.id,
    name: list.name,
    type: list.type,
    publicId: (list as { public_id?: string | null }).public_id ?? null,
    isReadOnly: (list as { is_read_only?: boolean }).is_read_only ?? list.isReadOnly,
    products: (list as { products?: { product_id: number; quantity: number }[] }).products?.map(
      (p) => ({
        productId: p.product_id,
        quantity: p.quantity,
      }),
    ),
  }));
}

export async function addToList(
  config: Config,
  session: Session,
  listId: number,
  productId: number,
  quantity: number,
) {
  const body = new URLSearchParams({
    product_id: String(productId),
    quantity: String(quantity),
  });

  const result = await requestEbag(config, session, `/lists/${listId}/items/update`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body,
  });

  return result.data;
}
