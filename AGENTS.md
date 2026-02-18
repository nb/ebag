# Architecture

## Overview

- TypeScript CLI built on a shared codebase.
- Cookie-based authentication; avoid automated login for stability.
- Human-readable CLI output by default; `--json` for scripting.

## Components

- Library (`src/lib/`)
  - `client.ts`: HTTP helpers for ebag and Algolia.
  - `auth.ts`: login instructions and session validation.
  - `search.ts`: list-first search + Algolia fallback; caching.
  - `cart.ts`: add/update cart.
  - `lists.ts`: list retrieval and list add.
  - `orders.ts`: order list/detail + slots; order caching.
  - `config.ts`: config/session/cache storage.
  - `types.ts`: shared types.
- CLI (`src/cli/`)
  - `index.ts`: command routing and error handling.
  - `format.ts`: human-readable output formatting.

## Code Boundaries

- Keep business logic in `src/lib/*` and keep `src/cli/format.ts` focused on presentation/output only.
- Put shared, cross-module contract types in `src/lib/types.ts` and keep file-private helper types local.

## Data and Storage

- Config: `~/.config/ebag/config.json`
  - Base URL and Algolia credentials (default values captured from network).
- Session: `~/.config/ebag/session.json`
  - Cookie header value; optional user agent.
- Cache: `~/.config/ebag/cache.json`
  - Product details cached by ID for list-based search (6 hour TTL; refreshed on search).
  - Orders cached by ID when `order_status === 4` (fulfilled/final).
- Override: `EBAG_CONFIG_DIR` can redirect storage for testing.

## Authentication

- Manual cookie import from browser network request headers.
- Session validation uses `GET https://www.ebag.bg/user/json`.
- CSRF handling:
  - Non-GET requests add `x-csrftoken` if `csrftoken` is present in cookies.
  - `origin` and `referer` headers are set for cart/list mutations.
- Session data is stored in plain text with owner-only permissions (`0600`).

## Search Flow

1. Load lists and collect product IDs.
2. Fetch product details per ID (with cache).
3. Filter local list products by query string.
4. Query Algolia and normalize hits.
5. Merge results (list products first), remove duplicates, then limit.

Algolia endpoint:

- `POST https://jmjmdq9hhx-dsn.algolia.net/1/indexes/*/queries`
- Headers: `x-algolia-application-id`, `x-algolia-api-key`, `content-type`.
- Body: JSON with `requests[]`, form-encoded params including `query` and `page`.

## Cart and List Operations

- Add to cart: `POST https://www.ebag.bg/cart/add`
  - Body: `product_id`, `quantity`, `unit_type_override`
- Update cart: `POST https://www.ebag.bg/cart/update`
  - Body: `product_id`, `quantity`, `unit_type_override`
- Lists:
  - `GET https://www.ebag.bg/lists/json`
  - Add: `POST https://www.ebag.bg/lists/{listId}/items/update`
    - Body: `product_id`, `quantity`

## Orders

- List: `GET https://www.ebag.bg/orders/list/json`
  - Query: `page`, `year`, `exclude_additional_order=true`
- Detail: `GET https://www.ebag.bg/orders/{encryptedId}/details/json`
- Additional orders are returned inside `order.additional_orders` for a primary order.

## Delivery Slots

- `GET https://www.ebag.bg/orders/get-time-slots`
- Response: map of `YYYY-MM-DD` → slot array (`start`, `end`, `is_available`, `load_percent`, `cutoff_after`).

## CLI Contract

- `ebag login --cookie "<cookie>"`
- `ebag status`
- `ebag slots`
- `ebag product search <query> [--limit N] [--page N]`
- `ebag product show <productId>`
- `ebag order list [--limit N] [--page N] [--from YYYY-MM-DD] [--to YYYY-MM-DD]`
- `ebag order show <orderId>`
- `ebag cart add <productId> [--qty N]`
- `ebag cart update <productId> [--qty N]`
- `ebag cart show`
- `ebag list show [listId]`
- `ebag list add <listId> <productId> [--qty N]`

## Product Details Output

- Human-readable output uses a YAML-style key/value block between `---` lines.
- Description is converted from HTML to Markdown.
- `Съставки` is split into a separate `# Ingredients` section.
- Energy values are normalized to `\d+.\d+` and split into `kcal`/`kJ` when combined.
- Prices prefer EUR (`current_price_eur`, `price_promo_eur`, `price_eur`).
- Dates are normalized to `YYYY-MM-DD`.

## Testing

- End-to-end tests exercise login, status, order list/show, search, cart add/update, list add.
- Requires `tests/.config/ebag/session.json` with a valid `cookies` value and network access.
- Tests use `EBAG_CONFIG_DIR` env var to isolate test config from production.
- Unit tests cover product output formatting (including date normalization).
- Run build and tests after each change:
  - `npm run build`
  - `npm run test:e2e`
- Skip build/tests for doc-only changes (`*.md`) unless explicitly requested.

## Operational Notes

- Treat cookie values and capture files as sensitive.
- Algolia credentials are observed public keys; may change.
- If endpoints or CSRF behavior change, refresh capture notes and update headers.

## Captures

- Stored in `captures/` as `capture-YYYYMMDD-HHMMSS.json` from `npm run capture` (`scripts/capture.mjs`).
- DevTools-style network dump: request URLs, methods, headers, bodies, and response payloads/snippets for the recorded session.
- Files store the network log under `captures[]` entries with `url`, `method`, `request`, `response`.
- Use `rg` to locate endpoints and payload shapes (e.g. `rg -n "lists/.*items/json" captures/capture-*.json`).
- Contains sensitive session context (cookies, account data); avoid sharing and rotate cookies if needed.
