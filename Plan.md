# Plan

## Phase 0: Discovery and constraints
- Use TypeScript; CLI is a thin layer over a library.
- Prefer stable auth (likely cookie/session reuse; avoid brittle automation).
- Store config/session in home directory.
- Human-readable output by default; every command supports `--json`.
- Define discovery workflow: use browser DevTools Network to capture requests, headers, cookies, CSRF tokens, and response shapes for each feature.
- For each feature, document the exact URL(s), method(s), payload(s), and required headers in a shared `docs/` note.

## Phase 1: Skeleton and configuration
- Create minimal project structure (CLI + library modules).
- Implement config loader/saver and session storage.
- Add command routing and help text.

## Phase 2: Authentication workflow
- Implement `login` instructions command.
- Support session persistence (cookie header / CSRF tokens if needed).
- Validate session with a lightweight request.
- Discovery step: identify login/session endpoints, required cookies, CSRF tokens, and how they persist across requests.
- Design step: decide on cookie import format and minimal required headers for stability.
  - Observed: session-based endpoints on `https://www.ebag.bg/` accept cookie auth; cart/list calls did not require explicit CSRF header in capture.
  - Candidates for session validation: `GET https://www.ebag.bg/user/json` (captured) or `GET https://www.ebag.bg/cart/json`.

## Phase 3: Product search
- Implement local list search first.
- Implement remote search by string.
- Normalize and persist results for reuse by ID.
- Discovery step: find search endpoint(s), request params, and result JSON/HTML structure; confirm pagination and relevance ordering.
- Design step: define search result normalization (id, name, price, URL) and local cache schema.
  - Observed: search uses Algolia.
    - Endpoint: `POST https://jmjmdq9hhx-dsn.algolia.net/1/indexes/*/queries`
    - Headers: `x-algolia-application-id: JMJMDQ9HHX`, `x-algolia-api-key: 42ca9458d9354298c7016ce9155d8481`, `content-type: application/x-www-form-urlencoded`
    - Body: JSON with `requests[]`, form-encoded; `params` includes `query=...`, `page=0`, `facets=...`, `clickAnalytics=true`.
    - Results: `results[0].hits` with fields like `id`, `name_bg`, `current_price`, `product_image_absolute_url`, `url_slug_bg`.

## Phase 4: Cart and list operations
- Implement add-to-cart by product ID.
- Implement add-to-list by product ID.
- Handle errors and success confirmation.
- Discovery step: identify cart/list endpoints, required tokens/headers, and success/error markers.
- Design step: define minimal payloads, id mapping from search results, and idempotency behavior.
  - Observed endpoints:
    - Add to cart: `POST https://www.ebag.bg/cart/add` body `product_id=...&quantity=...&unit_type_override=false` (form-encoded).
    - Update cart: `POST https://www.ebag.bg/cart/update` same form encoding (optional for quantity change).
    - Lists: `GET https://www.ebag.bg/lists/json`.
    - Add to list: `POST https://www.ebag.bg/lists/{listId}/items/update` body `product_id=...&quantity=...`.

## Phase 5: Hardening and docs
- Add logging and basic tests.
- Document setup, auth flow, and usage examples.
- Add a reproducible discovery checklist for future endpoint changes.
