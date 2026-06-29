# Contributing to MP3 Tag Editor

Thank you for your interest in contributing. This document explains how to get started.

## Git Flow

This repository uses Git Flow branching:

```
main          Production-ready releases
develop       Integration branch for features
feature/*     New features and enhancements
release/*     Release preparation and version bumps
hotfix/*      Critical fixes applied directly to main
```

### Typical workflow

1. Fork the repository and clone locally
2. Create a feature branch from `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```
3. Make changes, add tests if applicable, and commit
4. Open a pull request targeting `develop`
5. After review, changes merge into `develop`
6. Releases are cut from `release/x.y.z` into `main` and back-merged to `develop`

## Development setup

```bash
npm install
copy .env.example .env
npm run dev
```

## Code guidelines

- Match existing file structure and naming conventions
- Add brief comments for non-obvious logic (IPC handlers, ID3 edge cases, provider quirks)
- Keep commits focused and descriptive
- Update `CHANGELOG.md` for user-facing changes
- Bump version in `package.json`, `package-lock.json`, and `electron/constants.js` consumers when releasing

## Commit messages

Use clear, imperative subject lines:

```
Add Deezer duration to result list
Fix cover art base64 encoding on read
Update README for v1.1.0 release
```

## Pull requests

- Fill out the PR template completely
- Link related issues
- Ensure `npm run build` and `npm run lint` pass
- Do not add bots or AI tools as co-authors on commits

## Reporting issues

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) and include OS, Node version, and steps to reproduce.

## Code of conduct

All contributors are expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
