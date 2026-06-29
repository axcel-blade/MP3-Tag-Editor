const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SEARCH_URL = 'https://api.spotify.com/v1/search'

let cachedToken = null
let tokenExpiresAt = 0

async function getAccessToken(clientId, clientSecret) {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!response.ok) {
    const body = await response.text()
    if (response.status === 403 && /premium/i.test(body)) {
      throw new Error('Spotify requires Premium on the developer account')
    }
    throw new Error(`Spotify auth failed (${response.status})`)
  }

  const data = await response.json()
  cachedToken = data.access_token
  tokenExpiresAt = Date.now() + data.expires_in * 1000
  return cachedToken
}

function formatTrack(track) {
  const releaseDate = track.album?.release_date ?? ''
  return {
    id: `spotify:${track.id}`,
    source: 'Spotify',
    title: track.name ?? '',
    artist: track.artists?.map((a) => a.name).join(', ') ?? '',
    album: track.album?.name ?? '',
    year: releaseDate.slice(0, 4),
    genre: '',
    trackNumber: track.track_number ? String(track.track_number) : '',
    albumArtist: track.album?.artists?.map((a) => a.name).join(', ') ?? '',
    durationMs: track.duration_ms ?? null,
    artworkUrl: track.album?.images?.[0]?.url ?? null,
    externalUrl: track.external_urls?.spotify ?? '',
  }
}

export async function searchSpotify(query, tags, clientId, clientSecret, limit = 10) {
  if (!clientId || !clientSecret) {
    throw new Error('Spotify credentials not configured')
  }

  let q = query
  if (tags?.title || tags?.artist) {
    const parts = []
    if (tags.title) parts.push(`track:${tags.title}`)
    if (tags.artist) parts.push(`artist:${tags.artist}`)
    if (tags.album) parts.push(`album:${tags.album}`)
    q = parts.join(' ')
  }

  const token = await getAccessToken(clientId, clientSecret)
  const params = new URLSearchParams({ q, type: 'track', limit: String(limit) })

  const response = await fetch(`${SEARCH_URL}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    const body = await response.text()
    if (response.status === 403 && /premium/i.test(body)) {
      throw new Error('Spotify requires Premium on the developer account')
    }
    throw new Error(`Spotify HTTP ${response.status}`)
  }

  const data = await response.json()
  return (data.tracks?.items ?? []).map(formatTrack)
}
