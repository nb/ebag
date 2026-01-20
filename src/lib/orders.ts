import type { Config, Session } from './types';
import { requestEbag } from './client';

export async function getTimeSlots(
  config: Config,
  session: Session,
): Promise<Record<string, unknown>> {
  const result = await requestEbag<Record<string, unknown>>(
    config,
    session,
    '/orders/get-time-slots',
  );
  return result.data;
}
