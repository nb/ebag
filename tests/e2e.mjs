import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const cookieFilePath = new URL('./.secrets/ebag-cookies', import.meta.url).pathname;
const fileCookie = fs.existsSync(cookieFilePath) ? fs.readFileSync(cookieFilePath, 'utf8').trim() : '';
const cookie = process.env.EBAG_COOKIE || fileCookie;
const queryBg = process.env.EBAG_TEST_QUERY_BG || 'шоколад';
const queryMiss = process.env.EBAG_TEST_QUERY_MISS || 'kashdklsdas';

if (!cookie) {
  console.error('EBAG_COOKIE is required to run e2e tests (or add tests/.secrets/ebag-cookies).');
  process.exit(1);
}

const cliPath = new URL('../dist/cli/index.js', import.meta.url).pathname;

const configDir = new URL('../.tmp/ebag', import.meta.url).pathname;

async function runCli(args) {
  const { stdout } = await execFileAsync('node', [cliPath, '--json', ...args], {
    env: {
      ...process.env,
      EBAG_CONFIG_DIR: configDir,
    },
  });
  return JSON.parse(stdout);
}

async function runCliRaw(args) {
  const { stdout } = await execFileAsync('node', [cliPath, ...args], {
    env: {
      ...process.env,
      EBAG_CONFIG_DIR: configDir,
    },
  });
  return stdout;
}

function findCartItem(cart, productId) {
  const items = cart?.items || [];
  return items.find((item) => {
    const id = item?.product?.id ?? item?.product_id ?? item?.productId;
    return Number(id) === Number(productId);
  });
}

async function main() {
  console.log('e2e: login');
  await runCli(['login', '--cookie', cookie]);
  console.log('e2e: status');
  const status = await runCli(['status']);
  if (status.status !== 'logged_in') {
    throw new Error('Expected logged_in status after login.');
  }

  console.log('e2e: order list');
  const orders = await runCli(['order', 'list', '--limit', '1']);
  if (!orders?.results || orders.results.length === 0) {
    throw new Error('No orders returned.');
  }
  const orderId = orders.results[0].id;
  if (!orderId) {
    throw new Error('Missing order id.');
  }

  console.log('e2e: order show');
  const orderDetail = await runCli(['order', 'show', String(orderId)]);
  if (!orderDetail || orderDetail.id !== orderId) {
    throw new Error('Expected order details for order show.');
  }
  if (!orderDetail.address) {
    throw new Error('Order details missing address.');
  }
  if (!Array.isArray(orderDetail.items) || orderDetail.items.length === 0) {
    throw new Error('Order details missing items.');
  }

  console.log('e2e: product search bg');
  const searchBg = await runCli(['product', 'search', queryBg, '--limit', '5']);
  if (!searchBg.results || searchBg.results.length === 0) {
    throw new Error('Bulgarian search returned no results.');
  }

  const productId = searchBg.results[0].id;
  const productName = searchBg.results[0].name;
  if (!productId || !productName) {
    throw new Error('Missing product id from search.');
  }

  console.log('e2e: product show');
  const productOutput = await runCliRaw(['product', 'show', String(productId)]);
  if (!productOutput.includes('# Description')) {
    throw new Error('Product output missing Description heading.');
  }
  if (!productOutput.includes('Price:')) {
    throw new Error('Product output missing Price line.');
  }
  const separatorCount = productOutput.split('\n---\n').length - 1;
  if (separatorCount !== 2) {
    throw new Error('Product output should contain a single YAML block.');
  }

  console.log('e2e: product search miss');
  const searchMiss = await runCli(['product', 'search', queryMiss, '--limit', '5']);
  if (!searchMiss.results || searchMiss.results.length !== 0) {
    throw new Error('Expected empty results for missing search query.');
  }

  console.log('e2e: list show');
  const lists = await runCli(['list', 'show']);
  if (!Array.isArray(lists) || lists.length === 0) {
    throw new Error('No lists returned.');
  }

  const listId = lists[0].id;
  if (!listId) {
    throw new Error('Missing list id.');
  }
  const listDetail = await runCli(['list', 'show', String(listId)]);
  if (!listDetail || Number(listDetail.id) !== Number(listId)) {
    throw new Error('Expected list details for list show <listId>.');
  }

  console.log('e2e: cart add');
  await runCli(['cart', 'add', String(productId), '--qty', '1']);
  console.log('e2e: cart validate add');
  const cartAfterAdd = await runCli(['cart', 'show']);
  const added = findCartItem(cartAfterAdd, productId);
  if (!added) {
    throw new Error('Cart add did not include product.');
  }

  console.log('e2e: cart update');
  await runCli(['cart', 'update', String(productId), '--qty', '2']);
  console.log('e2e: cart validate update');
  const cartAfterUpdate = await runCli(['cart', 'show']);
  const updated = findCartItem(cartAfterUpdate, productId);
  const updatedQty = updated?.quantity ?? updated?.qty ?? updated?.count;
  if (!updated || Number(updatedQty) !== 2) {
    throw new Error('Cart update did not set quantity to 2.');
  }

  console.log('e2e: list add');
  await runCli(['list', 'add', String(listId), String(productId), '--qty', '1']);
  console.log('e2e: list validate add');
  const listsAfterAdd = await runCli(['list', 'show']);
  const listAfterAdd = listsAfterAdd.find((list) => Number(list.id) === Number(listId));
  const listProductIds = (listAfterAdd?.products || []).map((item) => item.productId);
  if (!listProductIds.includes(Number(productId))) {
    throw new Error('List add did not include product.');
  }
  const listDetailOutput = await runCliRaw(['list', 'show', String(listId)]);
  if (!listDetailOutput.includes(`${productId} ${productName}`)) {
    throw new Error('List detail output missing product name.');
  }

  console.log('e2e ok');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
