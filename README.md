# ebag

CLI for interacting with ebag.bg (unofficial).

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

## Data and storage

- Config is stored in `~/.config/ebag` (override with `EBAG_CONFIG_DIR`).
- Session data is stored in plain text at `~/.config/ebag/session.json` with owner-only permissions (`0600`).
- List-based search caches product details in `~/.config/ebag/cache.json` for up to 6 hours.
- Completed orders may be cached locally for faster access, and the order cache is retained indefinitely.

## Products

```bash
ebag product search "lindt"
ebag product search "lindt" --json
ebag product show 5128
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

### Unit tests

```bash
npm run test:unit
```

### End-to-end tests

Requires a valid session in `tests/.config/ebag/session.json` (gitignored):

```bash
npm run test:e2e
```

### All tests

```bash
npm test
```

## Changelog

### 0.1.2

- Log unknown order statuses in the lib layer and warn in the CLI
- Add tests for order status logging and CLI warnings

### 0.1.1

- Add logging in the config directory

### 0.1.0

- Initial release
