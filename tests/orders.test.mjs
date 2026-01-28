import assert from 'node:assert/strict';
import { outputOrderDetail, outputOrdersList } from '../dist/cli/format.js';

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

const RealDate = Date;
const fixedNow = new RealDate('2026-01-28T10:00:00Z');
global.Date = class extends RealDate {
  constructor(...args) {
    if (args.length === 0) {
      return new RealDate(fixedNow);
    }
    return new RealDate(...args);
  }
  static now() {
    return fixedNow.getTime();
  }
  static parse(value) {
    return RealDate.parse(value);
  }
  static UTC(...args) {
    return RealDate.UTC(...args);
  }
};

const listOutput = captureOutput(() =>
  outputOrdersList([
    {
      id: 'ORDER-NEW',
      shippingDate: '2026-01-28',
      timeSlotDisplay: 'от 10:00 до 11:00',
      status: 4,
      finalAmountEur: '12.34',
    },
    {
      id: 'ORDER-DONE',
      shippingDate: '2026-01-20',
      timeSlotDisplay: 'от 18:00 до 19:00',
      status: 4,
      finalAmountEur: '45.67',
    },
    {
      id: 'ORDER-CANCEL',
      shippingDate: '2026-01-10',
      timeSlotDisplay: 'от 08:00 до 09:00',
      status: 3,
      finalAmountEur: '1.23',
    },
  ]),
);

assert.match(listOutput, /ORDER-NEW .* - Нова - 12\.34 EUR/);
assert.match(listOutput, /ORDER-DONE .* - Завършена - 45\.67 EUR/);
assert.match(listOutput, /ORDER-CANCEL .* - Отказана - 1\.23 EUR/);

const detailOutput = captureOutput(() =>
  outputOrderDetail({
    id: 'ORDER-DETAIL',
    status: 3,
    shippingDate: '2024-10-15',
    timeSlotDisplay: '15 Октомври 2024 от 08:00 до 09:00',
    address: 'София, кв. Център, ул. Тест 1',
    totals: {
      totalPaidEur: '59.29',
      discountEur: '0.00',
      tipEur: '2.56',
    },
    items: [
      {
        name: 'Тест продукт',
        quantity: '1.000',
        unit: '1 бр.',
        priceEur: '1.48',
        group: 'Плодове и зеленчуци',
      },
    ],
  }),
);

assert.match(detailOutput, /Status: Отказана/);
assert.match(detailOutput, /Address: София, кв\. Център, ул\. Тест 1/);
assert.match(detailOutput, /Тест продукт/);

global.Date = RealDate;

console.log('orders.test ok');
