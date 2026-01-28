# ebag

CLI and library for interacting with ebag.bg (unofficial).

## Installation

```bash
npm install -g ebag
```

Or run without installing:

```bash
npx ebag --help
```

## Login

Get the cookie header from your browser and store it:

```bash
ebag login --cookie "<cookie>"
```

Notes:
- Session data is stored in plain text at `~/.config/ebag/session.json` with owner-only permissions (`0600`).
- List-based search caches product details in `~/.config/ebag/cache.json` (no TTL/eviction).
- Completed orders may be cached locally for faster access.

## Search

```bash
ebag search "lindt"
ebag search "lindt" --json
```

## Delivery slots

```bash
ebag slots
```

## Orders

```bash
ebag order list
ebag order list --from 2024-02-01 --to 2024-03-31
ebag order show DE9CD146FECD05BF
```

## Cart

```bash
ebag cart add 5128 --qty 1
ebag cart update 5128 --qty 2
ebag cart show
```

## Lists

```bash
ebag list show
ebag list add 753250 5128 --qty 1
ebag list show 753250
```

## Contributing

### Build

```bash
npm run build
```

### End-to-end tests

By default, `npm run test:e2e` reads cookies from `tests/.secrets/ebag-cookies` (gitignored).
You can also override with `EBAG_COOKIE`.

Optional query override:

```bash
EBAG_COOKIE="<cookie>" EBAG_TEST_QUERY="lindt" npm run test:e2e
```
Store test cookies in `tests/.secrets/ebag-cookies` (gitignored), then run:

```bash
npm run test:e2e
```
