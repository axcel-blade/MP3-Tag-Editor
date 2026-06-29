const BASE = 'https://itunes.apple.com/search'

function upgradeArtwork(url) {
  if (!url) return null
  return url.replace(/(\d+)x\d+/, '$1x$1').replace('100x100bb', '600x600bb')
}

export async function searchItunes(query, limit = 10) {
  const params = new URLSearchParams({
    term: query,
    entity: 'song',
    limit: String(limit),
  })

  const response = await fetch(`${BASE}?${params}`)
  if (!response.ok) {
    throw new Error(`iTunes HTTP ${response.status}`)
  }

  const data = await response.json()
  return (data.results ?? []).map((track) => ({
    id: `itunes:${track.trackId}`,
    source: 'iTunes',
    title: track.trackName ?? '',
    artist: track.artistName ?? '',
    album: track.collectionName ?? '',
    year: track.releaseDate ? String(track.releaseDate).slice(0, 4) : '',
    genre: track.primaryGenreName ?? '',
    trackNumber: track.trackNumber ? String(track.trackNumber) : '',
    albumArtist: track.artistName ?? '',
    durationMs: track.trackTimeMillis ?? null,
    artworkUrl: upgradeArtwork(track.artworkUrl100 ?? track.artworkUrl60),
    externalUrl: track.trackViewUrl ?? track.collectionViewUrl ?? '',
  }))
}
