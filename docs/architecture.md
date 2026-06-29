# Architecture

MP3 Tag Editor v1.1.0 is an Electron application with a React renderer and Node.js main process.

## Process model

```
┌─────────────────────────────────────────────────────────┐
│  Renderer (React + Vite)                                │
│  src/App.jsx — UI, state, Apply Tags modal              │
│  window.electronAPI — preload bridge                    │
└──────────────────────────┬──────────────────────────────┘
                           │ IPC (contextBridge)
┌──────────────────────────▼──────────────────────────────┐
│  Main process (Node.js + Electron)                      │
│  electron/main.js — window, IPC handlers                │
│  electron/mp3.js — read/write ID3 tags                  │
│  electron/files.js — recursive MP3 scan                 │
│  electron/metadata/ — provider search orchestration     │
└─────────────────────────────────────────────────────────┘
```

## IPC channels

| Channel | Purpose |
|---------|---------|
| `dialog:openMp3` | Native file picker for one MP3 |
| `dialog:openFolder` | Folder picker + recursive MP3 scan |
| `mp3:readTags` | Parse ID3 tags and cover art |
| `mp3:writeTags` | Update selected tags and optional artwork |
| `metadata:search` | Search providers using file tags |
| `metadata:searchCustom` | Search providers using free-text query |
| `metadata:getConfig` | Load API key configuration |
| `metadata:saveConfig` | Save keys from Settings UI |

## Metadata providers

Providers live in `electron/metadata/providers/`. Each exports a search function returning normalized track objects:

```js
{ id, source, title, artist, album, year, genre, trackNumber, albumArtist, artworkUrl, lyrics, durationMs }
```

`electron/metadata/search.js` runs selected providers in parallel via `Promise.all`, merges results, and collects per-provider errors without failing the entire search.

## Tag read/write

- **Read:** `music-metadata` for common tags + `node-id3` fallback for cover art and USLT lyrics
- **Write:** `NodeID3.update()` — partial updates preserve unselected frames
- **Artwork:** Downloaded via `fetch()` in main process, written as APIC front-cover frame (replaces existing)

## Configuration

Priority order for API keys:

1. `.env` file at project root (via `dotenv`)
2. `api-config.json` in Electron `userData` (Settings UI)

When `.env` contains keys, Settings inputs are disabled.

## Version source of truth

Application version is defined in `package.json` and imported by `electron/constants.js` for window title and MusicBrainz User-Agent defaults.
