# API Keys

MP3 Tag Editor v1.1.0 supports six metadata providers. Three work without API keys.

## No key required

| Provider | Notes |
|----------|-------|
| **MusicBrainz** | Set `MUSICBRAINZ_USER_AGENT` in `.env` (required by their API policy) |
| **iTunes Search** | Public search API, no registration |
| **Deezer** | Public search API, no registration |

Example User-Agent:

```env
MUSICBRAINZ_USER_AGENT=MP3TagEditor/1.1.0 (your-email@example.com)
```

## Optional providers

### Musixmatch

1. Register at [developer.musixmatch.com](https://developer.musixmatch.com/)
2. Add to `.env`:
   ```env
   MUSIXMATCH_API_KEY=your_key_here
   ```
3. Enables lyrics and enriched metadata

### Last.fm

1. Create an API account at [last.fm/api/account/create](https://www.last.fm/api/account/create)
2. Add to `.env`:
   ```env
   LASTFM_API_KEY=your_key_here
   ```

### Spotify

1. Create an app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Add credentials to `.env`:
   ```env
   SPOTIFY_CLIENT_ID=your_client_id
   SPOTIFY_CLIENT_SECRET=your_client_secret
   ```
3. **Requires Premium** on the Spotify developer account (403 error otherwise)

## Configuration methods

### `.env` file (recommended)

Place `.env` in the project root. Keys load automatically on app start. `.env` is gitignored.

### In-app Settings

When no `.env` keys are present, open **Settings** in the app header to save keys to Electron user data (`api-config.json`).

When `.env` contains keys, Settings inputs are disabled and env values take precedence.

## Security

- Never commit `.env` to version control
- Rotate keys if accidentally exposed
- Report security issues per [SECURITY.md](../SECURITY.md)
