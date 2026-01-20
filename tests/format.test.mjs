import assert from 'node:assert/strict';
import { formatHeading, outputProductDetail } from '../dist/cli/format.js';

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

const originalIsTTY = process.stdout.isTTY;
const originalNoColor = process.env.NO_COLOR;
try {
  Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
  delete process.env.NO_COLOR;
  assert.equal(formatHeading('Header'), '\u001b[1mHeader\u001b[0m');
  process.env.NO_COLOR = '1';
  assert.equal(formatHeading('Header'), 'Header');
} finally {
  Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, configurable: true });
  if (originalNoColor === undefined) {
    delete process.env.NO_COLOR;
  } else {
    process.env.NO_COLOR = originalNoColor;
  }
}

console.log('format.test ok');
