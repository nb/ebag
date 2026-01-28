import assert from 'node:assert/strict';
import { PRODUCT_CACHE_TTL_MS, isProductCacheFresh } from '../dist/lib/search.js';

const now = Date.parse('2026-01-28T12:00:00Z');

const freshEntry = {
  product: { id: 1, name: 'Test' },
  cachedAt: new Date(now - PRODUCT_CACHE_TTL_MS + 1000).toISOString(),
};
assert.equal(isProductCacheFresh(freshEntry, now), true);

const staleEntry = {
  product: { id: 2, name: 'Old' },
  cachedAt: new Date(now - PRODUCT_CACHE_TTL_MS - 1000).toISOString(),
};
assert.equal(isProductCacheFresh(staleEntry, now), false);

const invalidEntry = {
  product: { id: 3, name: 'Bad' },
  cachedAt: 'not-a-date',
};
assert.equal(isProductCacheFresh(invalidEntry, now), false);

console.log('search-cache.test ok');
