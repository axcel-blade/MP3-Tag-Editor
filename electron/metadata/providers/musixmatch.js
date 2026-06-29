const BASE = 'https://api.musixmatch.com/ws/1.1'

function cleanLyrics(body) {
  if (!body) return ''
  return body
    .split('\n')
    .filter((line) => !/\*.*NOT for Commercial/i.test(line) && !/^\*+$/.test(line.trim()))
    .join('\n')
    .trim()
}

async function musixmatchRequest(endpoint, apiKey, params) {
  const query = new URLSearchParams({ ...params, apikey: apiKey, format: 'json' })
  const response = await fetch(`${BASE}/${endpoint}?${query}`)

  if (!response.ok) {
    throw new Error(`Musixmatch HTTP ${response.status}`)
  }

  const data = await response.json()
  const status = data.message?.header?.status_code

  if (status !== 200) {
    const hint = data.message?.header?.hint ?? data.message?.header?.status_code
    throw new Error(`Musixmatch API error (${status}${hint ? `: ${hint}` : ''})`)
  }

  return data.message?.body ?? {}
}

async function fetchLyrics(trackId, apiKey) {
  const body = await musixmatchRequest('track.lyrics.get', apiKey, { track_id: String(trackId) })
  return cleanLyrics(body.lyrics?.lyrics_body ?? '')
}

function formatTrack(track, lyrics) {
  const genre = track.primary_genres?.music_genre_list?.[0]?.music_genre?.music_genre_name ?? ''
  const year = track.first_release_date ? String(track.first_release_date).slice(0, 4) : ''

  return {
    id: `musixmatch:${track.track_id}`,
    source: 'Musixmatch',
    title: track.track_name ?? '',
    artist: track.artist_name ?? '',
    album: track.album_name ?? '',
    year,
    genre,
    trackNumber: '',
    albumArtist: track.artist_name ?? '',
    durationMs: track.track_length ? Number(track.track_length) * 1000 : null,
    artworkUrl: track.album_coverart_100x100
      ? track.album_coverart_100x100.replace('100x100', '500x500')
      : null,
    externalUrl: track.track_share_url ?? '',
    lyrics: lyrics ?? '',
    hasLyrics: Boolean(lyrics),
  }
}

export async function searchMusixmatch(query, tags, apiKey, limit = 8) {
  if (!apiKey) {
    throw new Error('Musixmatch API key not configured (set MUSIXMATCH_API_KEY in .env)')
  }

  const params = {
    page_size: String(limit),
    page: '1',
    f_has_lyrics: '1',
  }

  if (tags?.title) params.q_track = tags.title
  if (tags?.artist) params.q_artist = tags.artist
  if (tags?.album) params.q_album = tags.album
  if (!tags?.title && !tags?.artist) params.q = query

  const body = await musixmatchRequest('track.search', apiKey, params)
  const trackList = body.track_list ?? []

  const withLyrics = await Promise.all(
    trackList.slice(0, limit).map(async (entry) => {
      const track = entry.track
      if (!track?.track_id || !track.has_lyrics) {
        return formatTrack(track ?? {}, '')
      }

      try {
        const lyrics = await fetchLyrics(track.track_id, apiKey)
        return formatTrack(track, lyrics)
      } catch {
        return formatTrack(track, '')
      }
    }),
  )

  return withLyrics.filter((t) => t.title)
}
