import fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getLogPath } from "../dist/lib/config.js";

const execFileAsync = promisify(execFile);

const configDir = new URL("./.config/ebag", import.meta.url).pathname;
const sessionFilePath = new URL("./.config/ebag/session.json", import.meta.url)
  .pathname;
const queryBg = "шоколад";
const queryMiss = "kashdklsdas";

let session;
try {
  session = JSON.parse(fs.readFileSync(sessionFilePath, "utf8"));
} catch {
  console.error(
    "Missing session.json for e2e tests. Create tests/.config/ebag/session.json first.",
  );
  process.exit(1);
}

const cookie = session?.cookies?.trim();
if (!cookie) {
  console.error(
    "session.json missing cookies value. Update tests/.config/ebag/session.json.",
  );
  process.exit(1);
}

const cliPath = new URL("../dist/cli/index.js", import.meta.url).pathname;
process.env.EBAG_CONFIG_DIR = configDir;
const logPath = getLogPath();

async function runCli(args) {
  const { stdout } = await execFileAsync("node", [cliPath, "--json", ...args]);
  return JSON.parse(stdout);
}

async function runCliRaw(args) {
  const { stdout } = await execFileAsync("node", [cliPath, ...args]);
  return stdout;
}

function findCartItem(cart, productId) {
  const items = cart?.items || [];
  return items.find((item) => {
    const id = item?.product?.id ?? item?.product_id ?? item?.productId;
    return Number(id) === Number(productId);
  });
}

function getExecErrorText(err) {
  if (!err || typeof err !== "object") return String(err);
  const stderr = typeof err.stderr === "string" ? err.stderr.trim() : "";
  const stdout = typeof err.stdout === "string" ? err.stdout.trim() : "";
  const message = typeof err.message === "string" ? err.message.trim() : "";
  return stderr || stdout || message || String(err);
}

async function main() {
  console.log("e2e: login");
  await runCli(["login", "--cookie", cookie]);
  console.log("e2e: status");
  const status = await runCli(["status"]);
  if (status.status !== "logged_in") {
    throw new Error("Expected logged_in status after login.");
  }

  console.log("e2e: order list");
  const orders = await runCli(["order", "list", "--limit", "1"]);
  if (!orders?.results || orders.results.length === 0) {
    throw new Error("No orders returned.");
  }
  const orderId = orders.results[0].id;
  if (!orderId) {
    throw new Error("Missing order id.");
  }

  console.log("e2e: order show");
  const orderDetail = await runCli(["order", "show", String(orderId)]);
  if (!orderDetail || orderDetail.id !== orderId) {
    throw new Error("Expected order details for order show.");
  }
  if (!orderDetail.address) {
    throw new Error("Order details missing address.");
  }
  if (!Array.isArray(orderDetail.items) || orderDetail.items.length === 0) {
    throw new Error("Order details missing items.");
  }

  console.log("e2e: product search bg");
  const searchBg = await runCli(["product", "search", queryBg, "--limit", "5"]);
  if (!searchBg.results || searchBg.results.length === 0) {
    throw new Error("Bulgarian search returned no results.");
  }

  const productId = searchBg.results[0].id;
  const productName = searchBg.results[0].name;
  if (!productId || !productName) {
    throw new Error("Missing product id from search.");
  }

  console.log("e2e: product show");
  const productOutput = await runCliRaw(["product", "show", String(productId)]);
  if (!productOutput.includes("# Description")) {
    throw new Error("Product output missing Description heading.");
  }
  if (!productOutput.includes("Price:")) {
    throw new Error("Product output missing Price line.");
  }
  const separatorCount = productOutput.split("\n---\n").length - 1;
  if (separatorCount !== 2) {
    throw new Error("Product output should contain a single YAML block.");
  }

  console.log("e2e: product search miss");
  const searchMiss = await runCli([
    "product",
    "search",
    queryMiss,
    "--limit",
    "5",
  ]);
  if (!searchMiss.results || searchMiss.results.length !== 0) {
    throw new Error("Expected empty results for missing search query.");
  }

  console.log("e2e: list show");
  const lists = await runCli(["list", "show"]);
  if (!Array.isArray(lists) || lists.length === 0) {
    throw new Error("No lists returned.");
  }

  const listId = lists[0].id;
  if (!listId) {
    throw new Error("Missing list id.");
  }
  const listDetail = await runCli(["list", "show", String(listId)]);
  if (!listDetail || Number(listDetail.id) !== Number(listId)) {
    throw new Error("Expected list details for list show <listId>.");
  }

  const candidates = searchBg.results
    .map((result) => ({
      id: Number(result?.id),
      name: String(result?.name || ""),
    }))
    .filter((result) => Number.isFinite(result.id) && result.id > 0);

  let mutationProductId = Number(productId);
  let mutationProductName = String(productName);
  let addError = "";

  console.log("e2e: cart add");
  for (const candidate of candidates) {
    try {
      await runCli(["cart", "add", String(candidate.id), "--qty", "1"]);
      mutationProductId = candidate.id;
      mutationProductName = candidate.name || mutationProductName;
      addError = "";
      break;
    } catch (err) {
      addError = getExecErrorText(err);
    }
  }
  if (addError) {
    throw new Error(
      `Could not add any search candidate to cart. Last error: ${addError}`,
    );
  }

  console.log("e2e: cart validate add");
  const cartAfterAdd = await runCli(["cart", "show"]);
  const added = findCartItem(cartAfterAdd, mutationProductId);
  if (!added) {
    throw new Error("Cart add did not include product.");
  }

  console.log("e2e: cart update missing --qty");
  try {
    await runCli(["cart", "update", String(mutationProductId)]);
    throw new Error("Expected cart update without --qty to fail.");
  } catch (err) {
    if (!err.stderr?.includes("required option")) {
      throw new Error("Expected required option error for cart update without --qty.");
    }
  }

  console.log("e2e: cart update");
  await runCli(["cart", "update", String(mutationProductId), "--qty", "2"]);
  console.log("e2e: cart validate update");
  const cartAfterUpdate = await runCli(["cart", "show"]);
  const updated = findCartItem(cartAfterUpdate, mutationProductId);
  const updatedQty = updated?.quantity ?? updated?.qty ?? updated?.count;
  if (!updated || Number(updatedQty) !== 2) {
    throw new Error("Cart update did not set quantity to 2.");
  }

  console.log("e2e: list add");
  await runCli([
    "list",
    "add",
    String(listId),
    String(mutationProductId),
    "--qty",
    "1",
  ]);
  console.log("e2e: list validate add");
  const listsAfterAdd = await runCli(["list", "show"]);
  const listAfterAdd = listsAfterAdd.find(
    (list) => Number(list.id) === Number(listId),
  );
  const listProductIds = (listAfterAdd?.products || []).map(
    (item) => item.productId,
  );
  if (!listProductIds.includes(Number(mutationProductId))) {
    throw new Error("List add did not include product.");
  }
  const listDetailOutput = await runCliRaw(["list", "show", String(listId)]);
  if (!listDetailOutput.includes(`${mutationProductId} ${mutationProductName}`)) {
    throw new Error("List detail output missing product name.");
  }

  console.log("e2e: log verify");
  if (!fs.existsSync(logPath)) {
    throw new Error("Log file was not created.");
  }
  const logText = fs.readFileSync(logPath, "utf8");
  if (!logText.includes('event="command.start"')) {
    throw new Error("Log file missing command.start entries.");
  }
  if (!logText.includes('event="command.finish"')) {
    throw new Error("Log file missing command.finish entries.");
  }
  if (cookie && logText.includes(cookie)) {
    throw new Error("Log file contains raw cookie value.");
  }

  console.log("e2e ok");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
