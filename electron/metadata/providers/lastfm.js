const BASE = 'https://ws.audioscrobbler.com/2.0/'

async function lastfmRequest(params) {
  const response = await fetch(`${BASE}?${params}`)
  if (!response.ok) {
    throw new Error(`Last.fm HTTP ${response.status}`)
  }
  return response.json()
}

async function enrichTrack(track, apiKey) {
  const infoParams = new URLSearchParams({
    method: 'track.getInfo',
    api_key: apiKey,
    artist: track.artist,
    track: track.name,
    format: 'json',
  })

  try {
    const info = await lastfmRequest(infoParams)
    const t = info.track
    if (!t) return track

    const image = [...(t.album?.image ?? [])].reverse().find((img) => img['#text'])
    return {
      id: `lastfm:${t.mbid || `${t.artist}-${t.name}`}`,
      source: 'Last.fm',
      title: t.name ?? track.name,
      artist: t.artist?.name ?? track.artist,
      album: t.album?.title ?? '',
      year: '',
      genre: t.toptags?.tag?.[0]?.name ?? '',
      trackNumber: t.trackNumber ? String(t.trackNumber) : '',
      albumArtist: t.artist?.name ?? track.artist,
      durationMs: t.duration ? Number(t.duration) : null,
      artworkUrl: image?.['#text'] || null,
      externalUrl: t.url ?? track.url ?? '',
    }
  } catch {
    return {
      id: `lastfm:${track.mbid || `${track.artist}-${track.name}`}`,
      source: 'Last.fm',
      title: track.name ?? '',
      artist: track.artist ?? '',
      album: '',
      year: '',
      genre: '',
      trackNumber: '',
      albumArtist: track.artist ?? '',
      durationMs: null,
      artworkUrl: null,
      externalUrl: track.url ?? '',
    }
  }
}

export async function searchLastfm(query, tags, apiKey, limit = 10) {
  if (!apiKey) {
    throw new Error('Last.fm API key not configured (set LASTFM_API_KEY in .env)')
  }

  const params = new URLSearchParams({
    method: 'track.search',
    api_key: apiKey,
    track: tags?.title || query,
    format: 'json',
    limit: String(limit),
  })
  if (tags?.artist) params.set('artist', tags.artist)

  const data = await lastfmRequest(params)
  const tracks = data.results?.trackmatches?.track ?? []
  const list = Array.isArray(tracks) ? tracks : tracks ? [tracks] : []

  const enriched = await Promise.all(list.slice(0, Math.min(limit, 5)).map((t) => enrichTrack(t, apiKey)))
  return enriched
}
