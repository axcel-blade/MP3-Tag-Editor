# Setup Guide

## Requirements

- **Node.js** 20.x or later
- **npm** 10.x or later
- **Windows**, macOS, or Linux

## Installation

```bash
git clone https://github.com/axcel-blade/mp3-tag-editor.git
cd mp3-tag-editor
npm install
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
npm run dev
```

Starts the Vite dev server and Electron window with hot reload.

### Production build

```bash
npm run build
```

Output:

- `dist/` — renderer bundle
- `dist-electron/` — main process bundle

### Lint

```bash
npm run lint
```

## Troubleshooting

### Electron failed to install

Delete `node_modules/electron` and run `npm install` again, or run:

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
