# ebag

CLI and library for interacting with ebag.bg (unofficial).

## Build

```bash
npm run build
```

## Login

Get the cookie header from your browser and store it:

```bash
node dist/cli/index.js login --cookie "<cookie>"
```

Notes:
- Session data is stored in plain text at `~/.config/ebag/session.json` with owner-only permissions (`0600`).

## Search

```bash
node dist/cli/index.js search "lindt"
node dist/cli/index.js search "lindt" --json
```

## Cart

```bash
node dist/cli/index.js cart add 5128 --qty 1
node dist/cli/index.js cart update 5128 --qty 2
node dist/cli/index.js cart show
```

## Lists

```bash
node dist/cli/index.js list ls
node dist/cli/index.js list add 753250 5128 --qty 1
```

## End-to-end tests

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
