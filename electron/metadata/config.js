import fs from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'
import { DEFAULT_USER_AGENT } from '../constants.js'

/** Path to optional API keys saved from the in-app Settings dialog. */
function getConfigPath() {
  return path.join(app.getPath('userData'), 'api-config.json')
}

/** Read API credentials from environment variables (.env). */
function envConfig() {
  return {
    lastfmApiKey: process.env.LASTFM_API_KEY?.trim() ?? '',
    musixmatchApiKey: process.env.MUSIXMATCH_API_KEY?.trim() ?? '',
    spotifyClientId: process.env.SPOTIFY_CLIENT_ID?.trim() ?? '',
    spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET?.trim() ?? '',
    musicbrainzUserAgent: process.env.MUSICBRAINZ_USER_AGENT?.trim() ?? DEFAULT_USER_AGENT,
  }
}

export async function getApiConfig() {
  const fromEnv = envConfig()
  const hasEnv = Boolean(
    fromEnv.lastfmApiKey ||
      fromEnv.musixmatchApiKey ||
      (fromEnv.spotifyClientId && fromEnv.spotifyClientSecret),
  )

  let saved = {}
  try {
    const raw = await fs.readFile(getConfigPath(), 'utf-8')
    saved = JSON.parse(raw)
  } catch {
    // no saved config
  }

  return {
    lastfmApiKey: fromEnv.lastfmApiKey || saved.lastfmApiKey || '',
    musixmatchApiKey: fromEnv.musixmatchApiKey || saved.musixmatchApiKey || '',
    spotifyClientId: fromEnv.spotifyClientId || saved.spotifyClientId || '',
    spotifyClientSecret: fromEnv.spotifyClientSecret || saved.spotifyClientSecret || '',
    musicbrainzUserAgent: fromEnv.musicbrainzUserAgent,
    hasEnvFile: hasEnv,
    source: hasEnv ? 'env' : saved.spotifyClientId || saved.lastfmApiKey ? 'settings' : 'none',
  }
}

export async function saveApiConfig(config) {
  await fs.writeFile(
    getConfigPath(),
    JSON.stringify(
      {
        lastfmApiKey: config.lastfmApiKey ?? '',
        musixmatchApiKey: config.musixmatchApiKey ?? '',
        spotifyClientId: config.spotifyClientId ?? '',
        spotifyClientSecret: config.spotifyClientSecret ?? '',
      },
      null,
      2,
    ),
    'utf-8',
  )
}

export function getMusicBrainzUserAgent(config) {
  return config.musicbrainzUserAgent || DEFAULT_USER_AGENT
}
