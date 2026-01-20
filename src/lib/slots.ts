import type { DeliverySlot } from './types';

export function normalizeSlots(data: Record<string, unknown>): DeliverySlot[] {
  const slots: DeliverySlot[] = [];
  for (const [date, entries] of Object.entries(data)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      const slot = entry as {
        key?: string;
        start?: number;
        end?: number;
        is_available?: boolean;
        load_percent?: number;
        cutoff_after?: string | null;
        is_pharmacy_restricted?: boolean;
        is_bakery_restricted?: boolean;
      };
      const start = Number(slot.start);
      const end = Number(slot.end);
      if (!slot.key || Number.isNaN(start) || Number.isNaN(end)) continue;
      slots.push({
        date,
        key: slot.key,
        start,
        end,
        isAvailable: Boolean(slot.is_available),
        loadPercent: Number(slot.load_percent ?? 0),
        cutoffAfter: slot.cutoff_after ?? null,
        isPharmacyRestricted: slot.is_pharmacy_restricted,
        isBakeryRestricted: slot.is_bakery_restricted,
      });
    }
  }
  return slots;
}

export function formatSlotTime(value: number) {
  const padded = String(Math.trunc(value)).padStart(4, '0');
  const hours = padded.slice(0, 2);
  const minutes = padded.slice(2);
  return `${hours}:${minutes}`;
}

export function formatSlotRange(start: number, end: number) {
  return `${formatSlotTime(start)}–${formatSlotTime(end)}`;
}

export function formatLoadPercent(value: number) {
  if (!Number.isFinite(value)) return '0%';
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

export function sortSlots(a: DeliverySlot, b: DeliverySlot) {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  return a.start - b.start;
}
