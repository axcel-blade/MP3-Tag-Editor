# Changelog

All notable changes to this project are documented here. Version numbers follow [Semantic Versioning](https://semver.org/).

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

[1.1.0]: https://github.com/axcel-blade/mp3-tag-editor/compare/v1.0.0...v1.1.0
