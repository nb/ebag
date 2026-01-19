#!/usr/bin/env node
import { Command } from 'commander';
import { addToCart, updateCart } from '../lib/cart';
import { getLoginInstructions, validateSession } from '../lib/auth';
import { loadConfig, loadSession, saveSession } from '../lib/config';
import { getLists, addToList } from '../lib/lists';
import { searchProducts } from '../lib/search';
import { outputJson, outputList, outputProducts } from './format';

function requireSessionCookie() {
  const session = loadSession();
  if (!session.cookies) {
    throw new Error('No session cookie found. Run `ebag login --cookie "<cookie>"` first.');
  }
  return session;
}

async function main() {
  const program = new Command();

  program
    .name('ebag')
    .description('CLI for interacting with ebag.bg')
    .option('--json', 'Output JSON');

  program
    .command('login')
    .description('Store session cookie and validate it')
    .option('--cookie <cookie>', 'Cookie header value from browser')
    .action(async (options) => {
      const config = loadConfig();
      const json = program.opts().json as boolean | undefined;

      if (!options.cookie) {
        if (json) {
          outputJson({ instructions: getLoginInstructions() });
        } else {
          process.stdout.write(`${getLoginInstructions()}\n`);
        }
        return;
      }

      const session = {
        cookies: options.cookie as string,
        updatedAt: new Date().toISOString(),
      };
      saveSession(session);

      try {
        const user = await validateSession(config, session);
        if (json) {
          outputJson({ status: 'ok', user });
        } else {
          process.stdout.write('Login session saved and validated.\n');
        }
      } catch (err) {
        if (json) {
          outputJson({ status: 'error', message: (err as Error).message });
        } else {
          process.stderr.write(`Login saved but validation failed: ${(err as Error).message}\n`);
        }
      }
    });

  program
    .command('search')
    .description('Search for products')
    .argument('<query>', 'Search query')
    .option('--limit <n>', 'Limit number of results', '20')
    .option('--page <n>', 'Algolia page number (0-based)', '0')
    .action(async (query, options) => {
      const config = loadConfig();
      const session = loadSession();
      const json = program.opts().json as boolean | undefined;
      const limit = Number(options.limit);
      const page = Number(options.page);

      const result = await searchProducts(config, session, query, { limit, page });
      if (json) {
        outputJson(result);
      } else {
        outputProducts(result.results);
      }
    });

  const cart = program.command('cart').description('Cart operations');
  cart
    .command('add')
    .argument('<productId>', 'Product ID')
    .option('--qty <n>', 'Quantity', '1')
    .action(async (productId, options) => {
      const config = loadConfig();
      const session = requireSessionCookie();
      const json = program.opts().json as boolean | undefined;
      const qty = Number(options.qty);

      const result = await addToCart(config, session, Number(productId), qty);
      if (json) {
        outputJson(result);
      } else {
        process.stdout.write('Added to cart.\n');
      }
    });

  cart
    .command('update')
    .argument('<productId>', 'Product ID')
    .option('--qty <n>', 'Quantity', '1')
    .action(async (productId, options) => {
      const config = loadConfig();
      const session = requireSessionCookie();
      const json = program.opts().json as boolean | undefined;
      const qty = Number(options.qty);

      const result = await updateCart(config, session, Number(productId), qty);
      if (json) {
        outputJson(result);
      } else {
        process.stdout.write('Cart updated.\n');
      }
    });

  const list = program.command('list').description('List operations');
  list
    .command('ls')
    .description('List your lists')
    .action(async () => {
      const config = loadConfig();
      const session = requireSessionCookie();
      const json = program.opts().json as boolean | undefined;

      const lists = await getLists(config, session);
      if (json) {
        outputJson(lists);
      } else {
        outputList(
          lists.map((item) => ({
            id: item.id,
            name: item.name,
            count: item.products?.length,
          })),
        );
      }
    });

  list
    .command('add')
    .argument('<listId>', 'List ID')
    .argument('<productId>', 'Product ID')
    .option('--qty <n>', 'Quantity', '1')
    .action(async (listId, productId, options) => {
      const config = loadConfig();
      const session = requireSessionCookie();
      const json = program.opts().json as boolean | undefined;
      const qty = Number(options.qty);

      const result = await addToList(config, session, Number(listId), Number(productId), qty);
      if (json) {
        outputJson(result);
      } else {
        process.stdout.write('Added to list.\n');
      }
    });

  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    const json = program.opts().json as boolean | undefined;
    if (json) {
      outputJson({ status: 'error', message: (err as Error).message });
    } else {
      process.stderr.write(`${(err as Error).message}\n`);
    }
    process.exit(1);
  }
}

main();
