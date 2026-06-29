# Changelog

All notable changes to this project are documented here. Version numbers follow [Semantic Versioning](https://semver.org/).

## [1.3.8] - 2026-06-29

### Fixed

- Auto-update download 404: installer filenames now match `latest.yml` (`MP3-Tag-Editor-Setup-*.exe`)
- Release workflow publishes only `latest*.yml` metadata (excludes `builder-debug.yml`)
- Update download failures show in the banner instead of crashing

## [1.3.7] - 2026-06-29

### Fixed

- Auto-rename no longer fails on Windows when artist/title names create paths longer than 260 characters
- Tag writes succeed even when auto-rename is skipped; status shows a rename warning

## [1.3.6] - 2026-06-29

### Fixed

- Auto-update 404: point feed at `axcel-blade/mp3-tag-editor` via generic `latest.yml` URL
- Update check returns a friendly error instead of crashing the Settings action

### Added

- Unit tests for metadata search, providers, settings, files, theme, and expanded mp3/backup/rename coverage

## [1.3.5] - 2026-06-29

### Added

- In-app auto-update from GitHub Releases (notification, download, restart to install)
- Settings → Check for updates
- Independent scroll for folder file list and metadata search results

## [1.3.4] - 2026-06-29

### Added

- Manual tag editing in the Current Tags panel (Edit tags / Save tags / Cancel)

### Fixed

- Backup before write uses resolved paths and UUID backup filenames
- Auto-rename returns the correct new path after tag write
- UI stays in sync when a file is renamed after save or undo

## [1.3.3] - 2026-06-29

### Fixed

- electron-builder Linux config (remove invalid `desktop` block that broke all platform builds)

## [1.3.2] - 2026-06-29

### Fixed

- GitHub Release workflow publishes Windows `.exe`, macOS `.dmg`, and Linux `.AppImage` + `.deb` installers

## [1.3.1] - 2026-06-29

### Fixed

- Linux `.deb` build: author email and maintainer for electron-builder
- Release builds no longer auto-publish to GitHub (workflow uploads installers instead)

## [1.3.0] - 2026-06-29

### Added

- Appearance theme dropdown in Settings (System / Dark / Light)
- System theme follows OS light/dark preference
- GitHub Actions CI and release workflows

### Fixed

- MP3 tag reading uses `node-id3` only (fixes Electron `music-metadata` module errors)
- CI install and unit tests on Linux (skip Electron binary in CI; backup module test isolation)
- ESLint configuration for Node/Electron and shared code

### Changed

- Theme toggle removed from header; theme control is Settings-only

## [1.2.0] - 2026-06-29

### Added

- Dark/light theme support and packaged installers (electron-builder)
- Auto file rename with custom template (Settings, off by default)
- Backup before write and **Undo Last Write**
- Drag-and-drop MP3 files
- Application log files (Settings → Open Log Folder)

## [1.1.0] - 2026-06-29

### Added

- Electron + Vite + React desktop application (replaces Python CLI script)
- Multi-provider metadata search: MusicBrainz, iTunes, Deezer, Musixmatch, Last.fm, Spotify
- Selectable search providers (key-free sources enabled by default)
- Batch folder support with file sidebar
- Apply Tags modal with field-by-field selection
- Album artwork download and embed (replaces existing cover)
- Lyrics support via Musixmatch (USLT frame)
- Settings dialog and `.env` configuration
- Git Flow branch structure and project documentation

### Removed

- Python `main.py` script and `requirements.txt`

### Changed

- Version bumped from 1.0.0 to 1.1.0
- README and docs rewritten for Electron app

## [1.0.0] - Earlier

- Initial Python-based MP3 tag editor with Spotify lookup

[1.3.8]: https://github.com/axcel-blade/mp3-tag-editor/compare/v1.3.7...v1.3.8
[1.3.7]: https://github.com/axcel-blade/mp3-tag-editor/compare/v1.3.6...v1.3.7
[1.3.6]: https://github.com/axcel-blade/mp3-tag-editor/compare/v1.3.5...v1.3.6
[1.3.5]: https://github.com/axcel-blade/mp3-tag-editor/compare/v1.3.4...v1.3.5
[1.3.4]: https://github.com/axcel-blade/MP3-Tag-Editor/compare/v1.3.3...v1.3.4
[1.3.3]: https://github.com/axcel-blade/MP3-Tag-Editor/compare/v1.3.2...v1.3.3
[1.3.2]: https://github.com/axcel-blade/MP3-Tag-Editor/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/axcel-blade/MP3-Tag-Editor/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/axcel-blade/MP3-Tag-Editor/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/axcel-blade/MP3-Tag-Editor/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/axcel-blade/mp3-tag-editor/compare/v1.0.0...v1.1.0
