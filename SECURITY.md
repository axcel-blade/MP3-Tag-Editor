# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 1.1.x   | Yes       |
| < 1.1   | No        |

## Reporting a vulnerability

If you discover a security vulnerability, please **do not** open a public issue.

Instead, report it privately by:

1. Opening a [GitHub Security Advisory](https://github.com/axcel-blade/mp3-tag-editor/security/advisories/new) on this repository, **or**
2. Contacting the repository owner through GitHub

Include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We aim to acknowledge reports within 72 hours and provide a status update within 7 days.

## Scope

Security concerns relevant to this project include:

- Arbitrary file read/write outside intended MP3 paths
- Remote code execution via metadata provider responses
- Exposure of API keys or credentials in logs or the renderer
- IPC channel abuse from the renderer process

## Best practices for users

- Keep API keys in `.env` (never commit `.env` to git)
- Only open MP3 files from trusted sources
- Download releases from official GitHub releases only
