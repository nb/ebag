import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const cookie = process.env.EBAG_COOKIE;
const queryBg = process.env.EBAG_TEST_QUERY_BG || 'шоколад';
const queryMiss = process.env.EBAG_TEST_QUERY_MISS || 'kashdklsdas';
const baseUrl = process.env.EBAG_BASE_URL || 'https://www.ebag.bg';

if (!cookie) {
  console.error('EBAG_COOKIE is required to run e2e tests.');
  process.exit(1);
}

const cliPath = new URL('../dist/cli/index.js', import.meta.url).pathname;

const configDir = new URL('../.tmp/ebagcli', import.meta.url).pathname;

async function runCli(args) {
  const { stdout } = await execFileAsync('node', [cliPath, '--json', ...args], {
    env: {
      ...process.env,
      EBAG_CONFIG_DIR: configDir,
    },
  });
  return JSON.parse(stdout);
}

async function fetchJson(path) {
  const response = await fetch(new URL(path, baseUrl), {
    headers: {
      cookie,
      accept: 'application/json, text/plain, */*',
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status}: ${text}`);
  }
  return JSON.parse(text);
}

function findCartItem(cart, productId) {
  const items = cart?.items || [];
  return items.find((item) => {
    const id = item?.product?.id ?? item?.product_id ?? item?.productId;
    return Number(id) === Number(productId);
  });
}

async function main() {
  await runCli(['login', '--cookie', cookie]);

  const searchBg = await runCli(['search', queryBg, '--limit', '5']);
  if (!searchBg.results || searchBg.results.length === 0) {
    throw new Error('Bulgarian search returned no results.');
  }

  const productId = searchBg.results[0].id;
  if (!productId) {
    throw new Error('Missing product id from search.');
  }

  const searchMiss = await runCli(['search', queryMiss, '--limit', '5']);
  if (!searchMiss.results || searchMiss.results.length !== 0) {
    throw new Error('Expected empty results for missing search query.');
  }

  const lists = await runCli(['list', 'ls']);
  if (!Array.isArray(lists) || lists.length === 0) {
    throw new Error('No lists returned.');
  }

  const listId = lists[0].id;
  if (!listId) {
    throw new Error('Missing list id.');
  }

  await runCli(['cart', 'add', String(productId), '--qty', '1']);
  const cartAfterAdd = await fetchJson('/cart/json');
  const added = findCartItem(cartAfterAdd, productId);
  if (!added) {
    throw new Error('Cart add did not include product.');
  }

  await runCli(['cart', 'update', String(productId), '--qty', '2']);
  const cartAfterUpdate = await fetchJson('/cart/json');
  const updated = findCartItem(cartAfterUpdate, productId);
  const updatedQty = updated?.quantity ?? updated?.qty ?? updated?.count;
  if (!updated || Number(updatedQty) !== 2) {
    throw new Error('Cart update did not set quantity to 2.');
  }

  await runCli(['list', 'add', String(listId), String(productId), '--qty', '1']);
  const listsAfterAdd = await runCli(['list', 'ls']);
  const listAfterAdd = listsAfterAdd.find((list) => Number(list.id) === Number(listId));
  const listProductIds = (listAfterAdd?.products || []).map((item) => item.productId);
  if (!listProductIds.includes(Number(productId))) {
    throw new Error('List add did not include product.');
  }

  console.log('e2e ok');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
