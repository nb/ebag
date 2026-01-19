# Architecture

## Overview
- TypeScript codebase with a thin CLI wrapper over a reusable library.
- Cookie-based authentication; avoid automated login for stability.
- Human-readable CLI output by default; `--json` for scripting.

## Components
- Library (`src/lib/`)
  - `client.ts`: HTTP helpers for ebag and Algolia.
  - `auth.ts`: login instructions and session validation.
  - `search.ts`: list-first search + Algolia fallback; caching.
  - `cart.ts`: add/update cart.
  - `lists.ts`: list retrieval and list add.
  - `config.ts`: config/session/cache storage.
  - `types.ts`: shared types.
- CLI (`src/cli/`)
  - `index.ts`: command routing and error handling.
  - `format.ts`: human-readable output formatting.

## Data and Storage
- Config: `~/.config/ebagcli/config.json`
  - Base URL and Algolia credentials (default values captured from network).
- Session: `~/.config/ebagcli/session.json`
  - Cookie header value; optional user agent.
- Cache: `~/.config/ebagcli/cache.json`
  - Product details cached by ID for list-based search.
- Override: `EBAG_CONFIG_DIR` can redirect storage for testing.

## Authentication
- Manual cookie import from browser network request headers.
- Session validation uses `GET https://www.ebag.bg/user/json`.
- CSRF handling:
  - Non-GET requests add `x-csrftoken` if `csrftoken` is present in cookies.
  - `origin` and `referer` headers are set for cart/list mutations.

## Search Flow
1) Load lists and collect product IDs.
2) Fetch product details per ID (with cache).
3) Filter local list products by query string.
4) Query Algolia and normalize hits.
5) Merge results (list products first), remove duplicates, then limit.

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

## CLI Contract
- `ebag login --cookie "<cookie>"`
- `ebag status`
- `ebag search <query> [--limit N] [--page N]`
- `ebag cart add <productId> [--qty N]`
- `ebag cart update <productId> [--qty N]`
- `ebag list ls`
- `ebag list add <listId> <productId> [--qty N]`

## Testing
- End-to-end tests exercise login, status, search, cart add/update, list add.
- Requires `EBAG_COOKIE` and network access.
- Tests use `EBAG_CONFIG_DIR` to avoid writing to home directory.
- Run build and tests after each change:
  - `npm run build`
  - `EBAG_COOKIE="<cookie>" npm run test:e2e`

## Operational Notes
- Treat cookie values and capture files as sensitive.
- Algolia credentials are observed public keys; may change.
- If endpoints or CSRF behavior change, refresh capture notes and update headers.
