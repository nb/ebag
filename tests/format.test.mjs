import assert from 'node:assert/strict';
import { outputProductDetail } from '../dist/cli/format.js';

function captureOutput(fn) {
  let output = '';
  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk) => {
    output += String(chunk);
    return true;
  };
  try {
    fn();
  } finally {
    process.stdout.write = originalWrite;
  }
  return output;
}

const sample = {
  id: 1,
  name: 'Test Product',
  unit_weight_text: '1 kg',
  current_price_eur: '3.99',
  expiry_date: '30/09/2026',
  description: '<p>Desc</p>',
};

const output = captureOutput(() => outputProductDetail(sample));
assert.match(output, /Expiry: 2026-09-30/);

console.log('format.test ok');
