import assert from "node:assert/strict";
import {
  formatHeading,
  outputList,
  outputProductDetail,
} from "../dist/cli/format.js";

function captureOutput(fn) {
  let output = "";
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
  name: "Test Product",
  unit_weight_text: "1 kg",
  current_price_eur: "3.99",
  expiry_date: "30/09/2026",
  description: "<p>Desc</p>",
};

const output = captureOutput(() => outputProductDetail(sample));
assert.match(output, /Expiry: 2026-09-30/);

const originalIsTTY = process.stdout.isTTY;
const originalNoColor = process.env.NO_COLOR;
try {
  Object.defineProperty(process.stdout, "isTTY", {
    value: true,
    configurable: true,
  });
  delete process.env.NO_COLOR;
  assert.equal(formatHeading("Header"), "\u001b[1mHeader\u001b[0m");
  process.env.NO_COLOR = "1";
  assert.equal(formatHeading("Header"), "Header");
} finally {
  Object.defineProperty(process.stdout, "isTTY", {
    value: originalIsTTY,
    configurable: true,
  });
  if (originalNoColor === undefined) {
    delete process.env.NO_COLOR;
  } else {
    process.env.NO_COLOR = originalNoColor;
  }
}

// outputList: available item has no suffix
{
  const out = captureOutput(() =>
    outputList([{ id: 1, name: "Milk", count: 2, available: true }]),
  );
  assert.equal(out, "1 Milk (2)\n");
}

// outputList: out of stock with expected date
{
  const out = captureOutput(() =>
    outputList([
      {
        id: 2,
        name: "Tomatoes",
        count: 1,
        available: false,
        expectedSupplyDate: "2026-02-07",
      },
    ]),
  );
  assert.equal(out, "2 Tomatoes (1) [out of stock, expected 2026-02-07]\n");
}

// outputList: out of stock without expected date
{
  const out = captureOutput(() =>
    outputList([{ id: 3, name: "Bread", count: 1, available: false }]),
  );
  assert.equal(out, "3 Bread (1) [out of stock, no restock date]\n");
}

// outputList: availability omitted (e.g. list/search callers) — no suffix
{
  const out = captureOutput(() =>
    outputList([{ id: 4, name: "Cheese", count: 0.5 }]),
  );
  assert.equal(out, "4 Cheese (0.5)\n");
}

// outputList: out of stock renders red on TTY
{
  const origIsTTY = process.stdout.isTTY;
  const origNoColor = process.env.NO_COLOR;
  try {
    Object.defineProperty(process.stdout, "isTTY", {
      value: true,
      configurable: true,
    });
    delete process.env.NO_COLOR;
    const out = captureOutput(() =>
      outputList([
        {
          id: 5,
          name: "Eggs",
          count: 1,
          available: false,
          expectedSupplyDate: "2026-03-01",
        },
      ]),
    );
    assert.equal(
      out,
      "5 Eggs (1) \u001b[33m[out of stock, expected 2026-03-01]\u001b[0m\n",
    );
  } finally {
    Object.defineProperty(process.stdout, "isTTY", {
      value: origIsTTY,
      configurable: true,
    });
    if (origNoColor === undefined) {
      delete process.env.NO_COLOR;
    } else {
      process.env.NO_COLOR = origNoColor;
    }
  }
}

console.log("format.test ok");
