import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchItunes } from '../electron/metadata/providers/itunes.js'
import { searchDeezer } from '../electron/metadata/providers/deezer.js'
import { searchMusicBrainz } from '../electron/metadata/providers/musicbrainz.js'

describe('searchItunes', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps iTunes API results to normalized tracks', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          results: [
            {
              trackId: 42,
              trackName: 'Song',
              artistName: 'Artist',
              collectionName: 'Album',
              releaseDate: '2021-05-01T07:00:00Z',
              primaryGenreName: 'Pop',
              trackNumber: 3,
              trackTimeMillis: 180000,
              artworkUrl100: 'https://example.com/100x100bb.jpg',
              trackViewUrl: 'https://music.apple.com/track/42',
            },
          ],
        }),
      })),
    )

    const results = await searchItunes('Song Artist', 5)
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      id: 'itunes:42',
      source: 'iTunes',
      title: 'Song',
      artist: 'Artist',
      album: 'Album',
      year: '2021',
      genre: 'Pop',
      trackNumber: '3',
      durationMs: 180000,
      artworkUrl: 'https://example.com/600x600bb.jpg',
    })
  })

  it('throws when iTunes returns a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })))
    await expect(searchItunes('query')).rejects.toThrow(/iTunes HTTP 503/)
  })
})

describe('searchDeezer', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps Deezer API results to normalized tracks', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 99,
              title: 'Track',
              duration: 200,
              link: 'https://deezer.com/track/99',
              artist: { name: 'Singer' },
              album: {
                title: 'LP',
                release_date: '2019-11-20',
                cover_xl: 'https://example.com/cover.jpg',
                artist: { name: 'Singer' },
              },
              track_position: 2,
            },
          ],
        }),
      })),
    )

    const results = await searchDeezer('Track Singer', 3)
    expect(results[0]).toMatchObject({
      id: 'deezer:99',
      source: 'Deezer',
      title: 'Track',
      artist: 'Singer',
      album: 'LP',
      year: '2019',
      trackNumber: '2',
      durationMs: 200000,
      artworkUrl: 'https://example.com/cover.jpg',
    })
  })
})

describe('searchMusicBrainz', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('builds a Lucene query from tags and maps recordings', async () => {
    const fetchMock = vi.fn(async (url, options) => {
      expect(String(url)).toContain('query=recording')
      expect(options.headers['User-Agent']).toBe('TestAgent/1.0')
      return {
        ok: true,
        json: async () => ({
          recordings: [
            {
              id: 'rec-1',
              title: 'Recording',
              length: 240000,
              'artist-credit': [{ name: 'Band' }],
              releases: [{ id: 'rel-1', title: 'Release', date: '2018-03-04', 'track-offset': 0 }],
            },
          ],
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    const results = await searchMusicBrainz(
      'ignored',
      { title: 'Recording', artist: 'Band' },
      5,
      'TestAgent/1.0',
    )

    expect(results[0]).toMatchObject({
      id: 'musicbrainz:rec-1',
      source: 'MusicBrainz',
      title: 'Recording',
      artist: 'Band',
      album: 'Release',
      year: '2018',
      trackNumber: '1',
      durationMs: 240000,
      artworkUrl: 'https://coverartarchive.org/release/rel-1/front',
    })
  })
})
