#!/usr/bin/env node
import { Command } from 'commander';
import { addToCart, getCart, updateCart } from '../lib/cart';
import { getLoginInstructions, validateSession } from '../lib/auth';
import { normalizeCookieInput, validateCookieInput } from '../lib/cookies';
import { loadConfig, loadSession, saveSession } from '../lib/config';
import { getListItems, getLists, addToList } from '../lib/lists';
import { getProductById } from '../lib/products';
import { searchProducts } from '../lib/search';
import { outputJson, outputList, outputProducts, outputProductDetail } from './format';

function requireSessionCookie() {
  const session = loadSession();
  if (!session.cookies) {
    throw new Error('No session cookie found. Run `ebag login --cookie "<cookie>"` first.');
  }
  return session;
}

function formatError(err: unknown) {
  const error = err as Error & { status?: number; body?: string };
  const details: Record<string, unknown> = { message: error.message };
  if (error.status) details.status = error.status;
  if (error.body) details.body = error.body;
  return details;
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

      const normalizedCookie = normalizeCookieInput(options.cookie as string);
      const cookieError = validateCookieInput(normalizedCookie);
      if (cookieError) {
        throw new Error(`${cookieError} Run \`ebag login --cookie "<cookie>"\` with a Cookie header value.`);
      }

      try {
        const session = {
          cookies: normalizedCookie,
          updatedAt: new Date().toISOString(),
        };
        const user = await validateSession(config, session);
        const email =
          (user as { email?: string; username?: string }).email ||
          (user as { email?: string; username?: string }).username;
        if (!email) {
          throw new Error('Session validated but no user email was returned.');
        }
        saveSession(session);
        if (json) {
          outputJson({ status: 'ok', user, email });
        } else {
          process.stdout.write('Login session validated and saved.\n');
          process.stdout.write(`Logged in as: ${email}\n`);
        }
      } catch (err) {
        if (json) {
          outputJson({ status: 'error', message: (err as Error).message });
        } else {
          process.stderr.write(`Login failed: ${(err as Error).message}\n`);
        }
      }
    });

  program
    .command('status')
    .description('Show current login status')
    .action(async () => {
      const config = loadConfig();
      const json = program.opts().json as boolean | undefined;
      const session = loadSession();

      if (!session.cookies) {
        if (json) {
          outputJson({ status: 'logged_out' });
        } else {
          process.stdout.write('Logged out (no session cookie).\n');
        }
        return;
      }

      try {
        const user = await validateSession(config, session);
        const email = (user as { email?: string; username?: string }).email || (user as { email?: string; username?: string }).username;
        if (json) {
          outputJson({ status: 'logged_in', user, email });
        } else {
          process.stdout.write('Logged in.\n');
          if (email) {
            process.stdout.write(`Email: ${email}\n`);
          }
        }
      } catch (err) {
        const error = err as Error & { status?: number };
        if (error.status && [401, 403].includes(error.status)) {
          if (json) {
            outputJson({ status: 'logged_out' });
          } else {
            process.stdout.write('Logged out.\n');
          }
          return;
        }
        throw err;
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

  program
    .command('product')
    .description('Get product details by ID')
    .argument('<productId>', 'Product ID')
    .action(async (productId) => {
      const config = loadConfig();
      const session = loadSession();
      const json = program.opts().json as boolean | undefined;

      const result = await getProductById(config, session, Number(productId));
      if (json) {
        outputJson(result);
      } else {
        outputProductDetail(result);
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

  cart
    .command('show')
    .description('Show cart contents')
    .action(async () => {
      const config = loadConfig();
      const session = requireSessionCookie();
      const json = program.opts().json as boolean | undefined;

      const cartData = await getCart(config, session);
      if (json) {
        outputJson(cartData);
        return;
      }
      const items = Array.isArray((cartData as { items?: unknown }).items)
        ? ((cartData as { items?: unknown[] }).items as unknown[])
        : [];
      const listItems = items
        .map((item) => {
          const entry = item as {
            product?: { id?: number; name?: string };
            product_id?: number;
            productId?: number;
            id?: number;
            name?: string;
            quantity?: number;
            qty?: number;
          };
          const id = entry.product?.id ?? entry.product_id ?? entry.productId ?? entry.id;
          const name = entry.product?.name ?? entry.name ?? 'Unknown';
          const count = entry.quantity ?? entry.qty;
          if (!id) return null;
          return { id: Number(id), name, count };
        })
        .filter(Boolean) as { id: number; name: string; count?: number }[];
      if (listItems.length) {
        outputList(listItems);
      } else {
        process.stdout.write('Cart is empty.\n');
      }
    });

  const list = program.command('list').description('List operations');
  list
    .command('show')
    .description('Show your lists')
    .argument('[listId]', 'List ID')
    .action(async (listId) => {
      const config = loadConfig();
      const session = requireSessionCookie();
      const json = program.opts().json as boolean | undefined;

      const lists = await getLists(config, session);
        if (listId) {
          const listEntry = lists.find((item) => Number(item.id) === Number(listId));
          if (!listEntry) {
            throw new Error(`List ${listId} not found.`);
          }
          const listItems = await getListItems(config, session, Number(listId));
          const results = Array.isArray((listItems as { results?: unknown }).results)
            ? ((listItems as { results?: unknown[] }).results as unknown[])
            : [];
          const count =
            typeof (listItems as { count?: number }).count === 'number'
              ? (listItems as { count?: number }).count
              : results.length;
          if (json) {
            outputJson({
              ...listEntry,
              count,
              items: results,
              next: (listItems as { next?: unknown }).next ?? null,
              previous: (listItems as { previous?: unknown }).previous ?? null,
            });
          } else {
            process.stdout.write(`${listEntry.name} (${listEntry.id})`);
            if (!count) {
              process.stdout.write(' - empty\n');
              return;
            }
            process.stdout.write(` - ${count} items\n`);
            const outputItems = results
              .map((item) => {
                const entry = item as {
                  product?: { id?: number; name?: string };
                  product_id?: number;
                  productId?: number;
                  id?: number;
                  name?: string;
                  quantity?: number;
                  qty?: number;
                };
                const product = entry.product as { id?: number; name?: string } | undefined;
                const id = product?.id ?? entry.product_id ?? entry.productId ?? entry.id;
                const name = product?.name ?? entry.name ?? 'Unknown';
                const itemCount = entry.quantity ?? entry.qty;
                if (!id) return null;
                return { id: Number(id), name, count: itemCount };
              })
              .filter(Boolean) as { id: number; name: string; count?: number }[];
            outputList(outputItems);
          }
          return;
        }

      if (json) {
        outputJson(lists);
        return;
      }
      outputList(
        lists.map((item) => ({
          id: item.id,
          name: item.name,
          count: item.products?.length,
        })),
      );
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
      outputJson({ status: 'error', ...formatError(err) });
    } else {
      const details = formatError(err);
      process.stderr.write(`${details.message}\n`);
      if (details.status) {
        process.stderr.write(`Status: ${details.status}\n`);
      }
      if (details.body) {
        process.stderr.write(`Body: ${details.body}\n`);
      }
    }
    process.exit(1);
  }
}

main();
