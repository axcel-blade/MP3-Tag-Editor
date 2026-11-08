# Setup Guide

## Requirements

- **Node.js** 22.12 or later
- **pnpm** 12.x — the exact version is pinned in `package.json` (`packageManager`). Install it with
  `corepack enable` (Node's built-in Corepack) or `npm install -g pnpm`
- **Windows**, macOS, or Linux

## Installation

```bash
git clone https://github.com/axcel-blade/mp3-tag-editor.git
cd mp3-tag-editor
pnpm install
```

The `postinstall` script runs `scripts/install-electron.js` to ensure Electron binaries are available (especially on Windows).

## Environment configuration

Copy the example env file:

```bash
# Windows
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

Edit `.env` with optional API keys. MusicBrainz, iTunes, and Deezer work without keys.

See [api-keys.md](api-keys.md) for provider-specific setup.

## Running the app

### Development

```bash
pnpm dev
```

Starts the Vite dev server and Electron window with hot reload.

### Production build

```bash
pnpm build
```

Output:

- `dist/` — renderer bundle
- `dist-electron/` — main process bundle

### Lint

```bash
pnpm lint
```

## Building installers

Package the app for distribution with [electron-builder](https://www.electron.build/):

```bash
# Current platform
pnpm run dist

# Windows (.exe NSIS installer) — run on Windows
pnpm run dist:win

# macOS (.dmg) — run on macOS
pnpm run dist:mac

# Linux (AppImage + .deb) — run on Linux
pnpm run dist:linux
```

Output goes to the `release/` folder. End users can install without Node.js or npm.

**CI:** Pushes and pull requests to `main` / `develop` run lint, tests, and build via GitHub Actions (`.github/workflows/ci.yml`).

**Releases:** Push a version tag (e.g. `v1.2.0`) to build Windows, macOS, and Linux installers and publish a GitHub Release (`.github/workflows/release.yml`).

**Note:** macOS and Linux builds must typically be run on their target OS (or CI). Windows builds work on your current machine.

## Troubleshooting

### Electron failed to install

Delete `node_modules/electron` and run `pnpm install` again, or run:

```bash
node scripts/install-electron.js
```

### Blank window on startup

Check the terminal for Vite errors. Ensure port 5173 is not blocked.

### `Cannot find module` in main process

Node built-ins and native packages (`dotenv`, `music-metadata`, `node-id3`) are externalized in `vite.config.js`. Do not import them in renderer code.

## Git branches

For development, work from `develop`:

```bash
git checkout develop
git checkout -b feature/my-change
```

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full Git Flow workflow.
