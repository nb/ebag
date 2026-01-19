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

## Search

```bash
node dist/cli/index.js search "lindt"
node dist/cli/index.js search "lindt" --json
```

## Cart

```bash
node dist/cli/index.js cart add 5128 --qty 1
node dist/cli/index.js cart update 5128 --qty 2
```

## Lists

```bash
node dist/cli/index.js list ls
node dist/cli/index.js list add 753250 5128 --qty 1
```

## End-to-end tests

Requires a valid cookie:

```bash
EBAG_COOKIE="<cookie>" npm run test:e2e
```

Optional query override:

```bash
EBAG_COOKIE="<cookie>" EBAG_TEST_QUERY="lindt" npm run test:e2e
```
