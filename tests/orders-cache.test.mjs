import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getCachePath } from "../dist/lib/config.js";
import { getOrderDetail } from "../dist/lib/orders.js";

const tmpDir = new URL("../.tmp/ebag-test-order-cache", import.meta.url)
  .pathname;
process.env.EBAG_CONFIG_DIR = tmpDir;

function writeCache(data) {
  const cachePath = getCachePath();
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), "utf8");
}

const cacheData = {
  products: {},
  orders: {
    "ORDER-123": {
      status: 4,
      updatedAt: "2026-02-01T00:00:00.000Z",
      detail: {
        id: "ORDER-123",
        status: 4,
        shippingDate: "2026-02-01",
        timeSlotDisplay: "",
        address: "",
        totals: {},
        items: [],
        additionalOrders: [
          {
            id: "ORDER-ADD",
            status: 0,
            totals: {},
            items: [],
          },
        ],
      },
    },
  },
};

writeCache(cacheData);

const config = {
  baseUrl: "https://www.ebag.bg",
  algolia: { appId: "", apiKey: "", host: "" },
};
const session = { cookies: "test" };

const detail = await getOrderDetail(config, session, "ORDER-123");
assert.equal(detail.statusDescription, "Завършена");
assert.equal(detail.additionalOrders?.[0]?.statusDescription, "Нова");

console.log("orders-cache.test ok");
