# Support

## Getting help

Before opening an issue, check:

- [README.md](README.md) — overview and quick start
- [docs/setup.md](docs/setup.md) — installation troubleshooting
- [docs/api-keys.md](docs/api-keys.md) — provider credential setup
- [CHANGELOG.md](CHANGELOG.md) — recent changes and known limitations

## Common issues

### Spotify returns 403

Spotify's Web API requires an **active Premium subscription** on the developer account. Use MusicBrainz, iTunes, or Deezer instead (no key required).

### No search results

- Confirm at least one source is enabled under **Search from**
- Try a custom search with artist + title
- Check provider errors in the status banner

### Cover art not updating

Ensure **Album Artwork** is checked in the Apply Tags modal before clicking **Apply Selected Tags**.

### App won't start on Windows

Run `npm install` again — the postinstall script downloads Electron. See [docs/setup.md](docs/setup.md).

## Bug reports

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) and include:

- Operating system and version
- Node.js version (`node -v`)
- Steps to reproduce
- Expected vs actual behavior
- Relevant console output

## Feature requests

Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md).

## Discussions

For questions and general discussion, use [GitHub Discussions](https://github.com/axcel-blade/mp3-tag-editor/discussions) if enabled, or open an issue with the question label.
