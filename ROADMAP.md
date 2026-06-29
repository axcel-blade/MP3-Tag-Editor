# Roadmap

High-level direction for MP3 Tag Editor. Timelines are approximate.

## v1.2 — Distribution & reliability

- **Packaged releases** — Windows `.exe`, macOS `.dmg`, Linux AppImage via electron-builder
- **Automated CI** — build, lint, and test on push to `develop`
- **Error boundaries** — graceful renderer crash recovery
- **Write safety** — optional backup copy before tag changes

## v1.3 — Batch workflows

- Apply selected metadata to multiple files in a folder
- Progress indicator for batch operations
- Conflict resolution when files have different existing tags

## v1.4 — Extended format support

- FLAC and M4A tag read/write
- Additional lyrics sources
- Custom tag field mapping

## v2.0 — Advanced features

- Local music library index
- Duplicate detection by audio fingerprint
- Plugin system for custom metadata providers
- Tag template presets (e.g. "Podcast", "Audiobook")

## Out of scope (for now)

- Audio playback / editing
- Cloud sync or account system
- Mobile apps

Feedback welcome via [feature requests](.github/ISSUE_TEMPLATE/feature_request.md).
