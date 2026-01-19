import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const cookie = process.env.EBAG_COOKIE;
const query = process.env.EBAG_TEST_QUERY || 'lindt';

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

async function main() {
  await runCli(['login', '--cookie', cookie]);

  const search = await runCli(['search', query, '--limit', '5']);
  if (!search.results || search.results.length === 0) {
    throw new Error('Search returned no results.');
  }

  const productId = search.results[0].id;
  if (!productId) {
    throw new Error('Missing product id from search.');
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
  await runCli(['cart', 'update', String(productId), '--qty', '2']);
  await runCli(['list', 'add', String(listId), String(productId), '--qty', '1']);

  console.log('e2e ok');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
