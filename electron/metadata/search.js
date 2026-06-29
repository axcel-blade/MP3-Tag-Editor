import { getApiConfig, getMusicBrainzUserAgent } from './config.js'
import { buildSearchQuery } from './query.js'
import { searchMusicBrainz } from './providers/musicbrainz.js'
import { searchItunes } from './providers/itunes.js'
import { searchDeezer } from './providers/deezer.js'
import { searchLastfm } from './providers/lastfm.js'
import { searchMusixmatch } from './providers/musixmatch.js'
import { searchSpotify } from './providers/spotify.js'

export const PROVIDERS = [
  { name: 'MusicBrainz', key: 'musicbrainz', requiresKey: false },
  { name: 'iTunes', key: 'itunes', requiresKey: false },
  { name: 'Deezer', key: 'deezer', requiresKey: false },
  { name: 'Musixmatch', key: 'musixmatch', requiresKey: true },
  { name: 'Last.fm', key: 'lastfm', requiresKey: true },
  { name: 'Spotify', key: 'spotify', requiresKey: true },
]

/** Providers searched without API keys by default. */
export const DEFAULT_SEARCH_PROVIDERS = ['musicbrainz', 'itunes', 'deezer']

const SEARCH_HANDLERS = {
  musicbrainz: (query, tags, limit, config, userAgent) =>
    searchMusicBrainz(query, tags, limit, userAgent),
  itunes: (query, _tags, limit) => searchItunes(query, limit),
  deezer: (query, _tags, limit) => searchDeezer(query, limit),
  musixmatch: (query, tags, limit, config) =>
    searchMusixmatch(query, tags, config.musixmatchApiKey, limit),
  lastfm: (query, tags, limit, config) => searchLastfm(query, tags, config.lastfmApiKey, limit),
  spotify: (query, tags, limit, config) =>
    searchSpotify(query, tags, config.spotifyClientId, config.spotifyClientSecret, limit),
}

/**
 * Query selected metadata providers in parallel and merge results.
 * Provider failures are collected in `errors` without aborting other sources.
 */
export async function searchAllMetadata(input, providers = DEFAULT_SEARCH_PROVIDERS, limit = 8) {
  const isTags = typeof input === 'object' && input !== null
  const query = buildSearchQuery(input)
  const tags = isTags ? input : null
  const config = await getApiConfig()
  const userAgent = getMusicBrainzUserAgent(config)

  const activeProviders = providers.filter((key) => SEARCH_HANDLERS[key])
  if (activeProviders.length === 0) {
    return { query, results: [], byProvider: {}, errors: [{ provider: 'none', message: 'No search sources selected' }] }
  }

  const entries = await Promise.all(
    activeProviders.map(async (key) => {
      try {
        const results = await SEARCH_HANDLERS[key](query, tags, limit, config, userAgent)
        return { key, results, error: null }
      } catch (err) {
        return { key, results: [], error: err.message }
      }
    }),
  )

  const byProvider = {}
  const errors = []
  let results = []

  for (const { key, results: providerResults, error } of entries) {
    byProvider[key] = providerResults
    if (error) errors.push({ provider: key, message: error })
    results = results.concat(providerResults)
  }

  return { query, results, byProvider, errors, searchedProviders: activeProviders }
}

export { buildSearchQuery }
