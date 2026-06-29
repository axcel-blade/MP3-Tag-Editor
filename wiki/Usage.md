# Usage Guide

How to edit MP3 tags with MP3 Tag Editor v1.1.0.

## 1. Open files

- **Open File** — select one MP3
- **Open Folder** — loads all MP3s recursively; use the sidebar to switch files

## 2. Review current tags

The left panel shows:

- Embedded album cover (if present)
- Title, artist, album, year, genre, track number, album artist
- Lyrics preview (if embedded)

## 3. Search metadata

On file load, the app searches enabled providers automatically.

- Toggle sources under **Search from** (MusicBrainz, iTunes, Deezer are on by default)
- Filter results with **Show** chips
- Run a **custom search** with any query string

## 4. Select a result

Click a result row. The **Apply Tags** modal opens with:

- Side-by-side current → new values per field
- **Album Artwork** checkbox (auto-checked when art is available)
- **Lyrics** checkbox (when Musixmatch returned lyrics)

Changed fields are highlighted in green.

## 5. Apply tags

1. Check the fields you want to write
2. Click **Apply Selected Tags**
3. The modal closes and **Current Tags** refreshes

### Album artwork

When **Album Artwork** is checked, the app downloads the result image and **replaces** the embedded front cover in the MP3 file.

Uncheck it to update text tags only.

## 6. Settings

Open **Settings** in the header to configure optional API keys (Musixmatch, Last.fm, Spotify).

Prefer `.env` for local development — see [docs/api-keys.md](../docs/api-keys.md).

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| **Esc** | Close Apply Tags modal |

## Tips

- Spotify requires Premium on the developer account; use Deezer or iTunes as free alternatives
- Click outside the modal or **Cancel** to dismiss without saving
- Provider errors appear in the status banner but don't block other sources
