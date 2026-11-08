const BASE = 'https://api.discogs.com'

/** Releases whose tracklists are fetched to find the matching track (Discogs allows 60 requests/min). */
const MAX_ENRICHED_RELEASES = 3

async function discogsRequest(urlPath, params, token, userAgent) {
  const url = `${BASE}${urlPath}${params ? `?${params}` : ''}`
  const response = await fetch(url, {
    headers: {
      Authorization: `Discogs token=${token}`,
      'User-Agent': userAgent,
    },
  })
  if (!response.ok) {
    throw new Error(`Discogs HTTP ${response.status}`)
  }
  return response.json()
}

function normalizeTitle(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** Strip Discogs' "(2)" disambiguation suffix from artist names. */
function cleanArtist(name) {
  return String(name ?? '').replace(/\s*\(\d+\)$/, '').trim()
}

/** Find the tracklist entry matching the file's title (exact, then partial). */
export function matchTrack(tracklist, title) {
  const wanted = normalizeTitle(title)
  if (!wanted) return null
  const tracks = (tracklist ?? []).filter((t) => t.type_ === undefined || t.type_ === 'track')
  return (
    tracks.find((t) => normalizeTitle(t.title) === wanted) ??
    tracks.find((t) => {
      const name = normalizeTitle(t.title)
      return name && (name.includes(wanted) || wanted.includes(name))
    }) ??
    null
  )
}

/** Map a search hit (+ optional release details) to the app's normalized track shape. */
export function toTrack(hit, release, title) {
  const [artistPart, ...albumParts] = String(hit.title ?? '').split(' - ')
  const artist = cleanArtist(release?.artists?.[0]?.name ?? artistPart)
  const album = release?.title ?? albumParts.join(' - ')
  const track = release ? matchTrack(release.tracklist, title) : null
  const position = track?.position && /^\d+$/.test(track.position) ? track.position : ''

  return {
    id: `discogs:${hit.id}${track ? `:${track.position}` : ''}`,
    source: 'Discogs',
    title: track?.title ?? '',
    artist: cleanArtist(track?.artists?.[0]?.name) || artist,
    album,
    year: String(release?.year || hit.year || ''),
    genre: (release?.styles?.[0] ?? hit.style?.[0] ?? release?.genres?.[0] ?? hit.genre?.[0] ?? '').trim(),
    trackNumber: position,
    albumArtist: artist,
    durationMs: null,
    artworkUrl: hit.cover_image || release?.images?.[0]?.uri || null,
    externalUrl: hit.uri ? `https://www.discogs.com${hit.uri}` : '',
  }
}

/**
 * Search Discogs releases. Discogs is album-oriented: the track title and number
 * are only filled in when the file's title matches a track on the release.
 */
export async function searchDiscogs(query, tags, token, userAgent, limit = 8) {
  if (!token) {
    throw new Error('Discogs token not configured (set DISCOGS_TOKEN in .env)')
  }

  const params = new URLSearchParams({ type: 'release', per_page: String(limit) })
  if (tags?.artist) params.set('artist', tags.artist)
  if (tags?.album) params.set('release_title', tags.album)
  if (!tags?.artist && !tags?.album) params.set('q', query)
  else if (tags?.title && !tags?.album) params.set('track', tags.title)

  const data = await discogsRequest('/database/search', params, token, userAgent)
  const hits = (data.results ?? []).slice(0, limit)

  return Promise.all(
    hits.map(async (hit, index) => {
      if (index >= MAX_ENRICHED_RELEASES) return toTrack(hit, null, tags?.title)
      try {
        const release = await discogsRequest(`/releases/${hit.id}`, null, token, userAgent)
        return toTrack(hit, release, tags?.title)
      } catch {
        return toTrack(hit, null, tags?.title)
      }
    }),
  )
}
