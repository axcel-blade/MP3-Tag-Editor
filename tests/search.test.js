import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../electron/metadata/config.js', () => ({
  getApiConfig: vi.fn(async () => ({
    lastfmApiKey: '',
    musixmatchApiKey: '',
    spotifyClientId: '',
    spotifyClientSecret: '',
    musicbrainzUserAgent: 'TestAgent/1.0',
    hasEnvFile: false,
    source: 'none',
  })),
  getMusicBrainzUserAgent: (config) => config.musicbrainzUserAgent,
}))

import { searchAllMetadata } from '../electron/metadata/search.js'

describe('searchAllMetadata', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns an error when no providers are selected', async () => {
    const response = await searchAllMetadata({ title: 'Song', artist: 'Artist' }, [])
    expect(response.results).toEqual([])
    expect(response.errors[0].message).toMatch(/No search sources selected/)
  })

  it('merges successful provider results and collects provider errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (String(url).includes('itunes.apple.com')) {
          return {
            ok: true,
            json: async () => ({
              results: [
                {
                  trackId: 1,
                  trackName: 'Hit',
                  artistName: 'Star',
                  collectionName: 'Hits',
                  releaseDate: '2020-01-01',
                  primaryGenreName: 'Pop',
                  artworkUrl100: 'https://example.com/100x100bb.jpg',
                },
              ],
            }),
          }
        }
        if (String(url).includes('deezer.com')) {
          return { ok: false, status: 500 }
        }
        throw new Error(`Unexpected fetch: ${url}`)
      }),
    )

    const response = await searchAllMetadata(
      { title: 'Hit', artist: 'Star' },
      ['itunes', 'deezer'],
      5,
    )

    expect(response.query).toBe('Hit Star')
    expect(response.results).toHaveLength(1)
    expect(response.results[0].source).toBe('iTunes')
    expect(response.byProvider.itunes).toHaveLength(1)
    expect(response.byProvider.deezer).toEqual([])
    expect(response.errors).toEqual([{ provider: 'deezer', message: 'Deezer HTTP 500' }])
    expect(response.searchedProviders).toEqual(['itunes', 'deezer'])
  })
})
