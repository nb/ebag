import assert from 'node:assert/strict';
import { formatLoadPercent, formatSlotRange, formatSlotTime, normalizeSlots } from '../dist/lib/slots.js';

assert.equal(formatSlotTime(800), '08:00');
assert.equal(formatSlotTime(1800), '18:00');
assert.equal(formatSlotRange(930, 1045), '09:30–10:45');
assert.equal(formatLoadPercent(100), '100%');
assert.equal(formatLoadPercent(99.6), '99.6%');

const sample = {
  '2026-01-19': [
    {
      key: '1800-1900_11700',
      start: 1800,
      end: 1900,
      is_available: true,
      load_percent: 100.0,
    },
  ],
};
const normalized = normalizeSlots(sample);
assert.equal(normalized.length, 1);
assert.equal(normalized[0].date, '2026-01-19');
assert.equal(normalized[0].isAvailable, true);

console.log('slots.test ok');
