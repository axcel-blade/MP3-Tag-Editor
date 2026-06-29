# MP3 Tag Editor

[![Version](https://img.shields.io/badge/version-1.3.4-blue.svg)](CHANGELOG.md)
[![CI](https://github.com/axcel-blade/MP3-Tag-Editor/actions/workflows/ci.yml/badge.svg)](https://github.com/axcel-blade/MP3-Tag-Editor/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Electron desktop app that reads MP3 ID3 tags, searches multiple metadata APIs in parallel, and lets you selectively apply tags—including lyrics and album artwork—back to your files.

## Features

- Open a single MP3 or an entire folder (recursive scan)
- Read current tags and embedded cover art
- Search MusicBrainz, iTunes, Deezer, Musixmatch, Last.fm, and Spotify
- Filter results by source; choose which providers to query
- Apply tags field-by-field via a modal popup
- Edit tags manually in the Current Tags panel
- Replace embedded album artwork when **Album Artwork** is checked
- Optional lyrics embedding (Musixmatch)

## Quick start

```bash
git clone https://github.com/axcel-blade/mp3-tag-editor.git
cd mp3-tag-editor
npm install
copy .env.example .env   # optional API keys
npm run dev
```

See [docs/setup.md](docs/setup.md) for detailed installation and [docs/api-keys.md](docs/api-keys.md) for provider credentials.

## Metadata sources

| Source | API key required |
|--------|------------------|
| **MusicBrainz** | No (User-Agent recommended) |
| **iTunes Search** | No |
| **Deezer** | No |
| **Musixmatch** | Yes — lyrics + metadata |
| **Last.fm** | Yes |
| **Spotify** | Yes (Premium on developer account) |

By default, only key-free sources are enabled: MusicBrainz, iTunes, and Deezer.

## Usage

1. Click **Open File** or **Open Folder**
2. Review **Current Tags** on the left
3. Browse **Metadata Results** on the right (filter by source)
4. Click a result → **Apply Tags** modal opens
5. Check fields, **Album Artwork**, and/or **Lyrics**
6. Click **Apply Selected Tags**

## Project structure

```
electron/           Main process — IPC, MP3 I/O, metadata providers
src/                React renderer UI
docs/               Extended documentation
.github/            Issue and PR templates
```

## Building installers (v1.2.0+)

```bash
npm run dist:win    # Windows .exe installer → release/
npm run dist:mac    # macOS .dmg (on Mac)
npm run dist:linux  # Linux AppImage + .deb
```

See [docs/setup.md](docs/setup.md) for details. Optional app icon: place a 256×256 PNG at `build-resources/icon.png`.

## Download installers

Pre-built desktop installers are published on **[GitHub Releases](https://github.com/axcel-blade/MP3-Tag-Editor/releases)**:

| Platform | File |
|----------|------|
| Windows | `MP3 Tag Editor Setup *.exe` |
| macOS | `MP3 Tag Editor *.dmg` |
| Linux | `MP3 Tag Editor *.AppImage` and `mp3-tag-editor_*_amd64.deb` |

Pick the latest **v1.3.x** release. No Node.js required to run the installed app.

## Theme

Use **Settings → Appearance** to choose **System**, **Dark**, or **Light** theme.

This project follows [Git Flow](CONTRIBUTING.md#git-flow):

| Branch | Purpose |
|--------|---------|
| `main` | Production releases |
| `develop` | Integration branch |
| `feature/*` | New features |
| `release/*` | Release preparation |
| `hotfix/*` | Urgent production fixes |

```bash
npm run dev      # Electron + Vite dev server
npm run build    # Production build
npm run lint     # ESLint
```

## Documentation

- [Architecture](docs/architecture.md)
- [Setup guide](docs/setup.md)
- [API keys](docs/api-keys.md)
- [Changelog](CHANGELOG.md)
- [Roadmap](ROADMAP.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Support](SUPPORT.md)

## License

[MIT](LICENSE) — Copyright © 2026 Axcel Blade
