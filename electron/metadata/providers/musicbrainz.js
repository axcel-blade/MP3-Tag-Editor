const BASE = 'https://musicbrainz.org/ws/2'

function pickYear(date) {
  if (!date) return ''
  return String(date).slice(0, 4)
}

export async function searchMusicBrainz(query, tags, limit, userAgent) {
  let luceneQuery = query
  if (tags?.title || tags?.artist) {
    const parts = []
    if (tags.title) parts.push(`recording:"${tags.title.replace(/"/g, '\\"')}"`)
    if (tags.artist) parts.push(`artist:"${tags.artist.replace(/"/g, '\\"')}"`)
    luceneQuery = parts.join(' AND ')
  }

  const params = new URLSearchParams({
    query: luceneQuery,
    fmt: 'json',
    limit: String(limit),
  })

  const response = await fetch(`${BASE}/recording?${params}`, {
    headers: { 'User-Agent': userAgent },
  })

  if (!response.ok) {
    throw new Error(`MusicBrainz HTTP ${response.status}`)
  }

  const data = await response.json()
  const recordings = data.recordings ?? []

  const results = recordings.slice(0, limit).map((rec) => {
      const artist = rec['artist-credit']?.map((a) => a.name).join(', ') ?? ''
      const release = rec.releases?.[0]

      return {
        id: `musicbrainz:${rec.id}`,
        source: 'MusicBrainz',
        title: rec.title ?? '',
        artist,
        album: release?.title ?? '',
        year: pickYear(release?.date),
        genre: rec.tags?.[0]?.name ?? '',
        trackNumber: release?.['track-offset'] != null ? String(release['track-offset'] + 1) : '',
        albumArtist: artist,
        durationMs: rec.length ?? null,
        artworkUrl: release?.id ? `https://coverartarchive.org/release/${release.id}/front` : null,
        externalUrl: `https://musicbrainz.org/recording/${rec.id}`,
      }
    })

  return results
}
