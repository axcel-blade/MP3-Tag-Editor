# Changelog

All notable changes to this project are documented here. Version numbers follow [Semantic Versioning](https://semver.org/).

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

[1.3.2]: https://github.com/axcel-blade/MP3-Tag-Editor/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/axcel-blade/MP3-Tag-Editor/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/axcel-blade/MP3-Tag-Editor/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/axcel-blade/MP3-Tag-Editor/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/axcel-blade/mp3-tag-editor/compare/v1.0.0...v1.1.0
