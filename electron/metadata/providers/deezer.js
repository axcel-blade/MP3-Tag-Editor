const BASE = 'https://api.deezer.com/search/track'

export async function searchDeezer(query, limit = 10) {
  const params = new URLSearchParams({ q: query, limit: String(limit) })
  const response = await fetch(`${BASE}?${params}`)

  if (!response.ok) {
    throw new Error(`Deezer HTTP ${response.status}`)
  }

  const data = await response.json()
  return (data.data ?? []).map((track) => ({
    id: `deezer:${track.id}`,
    source: 'Deezer',
    title: track.title ?? '',
    artist: track.artist?.name ?? '',
    album: track.album?.title ?? '',
    year: track.album?.release_date ? String(track.album.release_date).slice(0, 4) : '',
    genre: '',
    trackNumber: track.track_position ? String(track.track_position) : '',
    albumArtist: track.album?.artist?.name ?? track.artist?.name ?? '',
    durationMs: track.duration ? track.duration * 1000 : null,
    artworkUrl: track.album?.cover_xl ?? track.album?.cover_big ?? track.album?.cover_medium ?? null,
    externalUrl: track.link ?? '',
  }))
}
