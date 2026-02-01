import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getLogPath } from "../dist/lib/config.js";
import {
  isKnownOrderStatus,
  logUnknownOrderStatus,
} from "../dist/lib/order-status.js";

const tmpDir = new URL("../.tmp/ebag-test-order-status", import.meta.url)
  .pathname;
process.env.EBAG_CONFIG_DIR = tmpDir;

function resetLog() {
  const logPath = getLogPath();
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  if (fs.existsSync(logPath)) {
    fs.unlinkSync(logPath);
  }
  return logPath;
}

assert.equal(isKnownOrderStatus(0), true);
assert.equal(isKnownOrderStatus(3), true);
assert.equal(isKnownOrderStatus(4), true);
assert.equal(isKnownOrderStatus(99), false);

const logPath = resetLog();
logUnknownOrderStatus({
  status: 99,
  statusText: "Нова",
  orderId: "ORDER-X",
  source: "list",
});
const logText = fs.readFileSync(logPath, "utf8");
assert.match(logText, /event="order_status_unknown"/);
assert.match(logText, /status=99/);
assert.match(logText, /orderId="ORDER-X"/);
assert.match(logText, /statusText="Нова"/);
assert.match(logText, /source="list"/);

const logPathKnown = resetLog();
logUnknownOrderStatus({ status: 4, orderId: "ORDER-KNOWN", source: "detail" });
assert.equal(fs.existsSync(logPathKnown), false);

console.log("order-status.test ok");
