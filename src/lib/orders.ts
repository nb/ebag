import type { Config, Session } from './types';
import { requestEbag } from './client';

export async function getTimeSlots(
  config: Config,
  session: Session,
  options: { cityKey?: string; addressEncryptedId?: string } = {},
): Promise<Record<string, unknown>> {
  const query: Record<string, string | number | undefined> = {
    city_key: options.cityKey,
    address_encrypted_id: options.addressEncryptedId,
  };
  const result = await requestEbag<Record<string, unknown>>(
    config,
    session,
    '/orders/get-time-slots',
    { query },
  );
  return result.data;
}
