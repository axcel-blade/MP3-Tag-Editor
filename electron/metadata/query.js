export function buildSearchQuery(tags) {
  if (typeof tags === 'string') return tags.trim()

  const parts = []
  if (tags.title) parts.push(tags.title)
  if (tags.artist) parts.push(tags.artist)
  if (tags.album) parts.push(tags.album)

  const joined = parts.join(' ').trim()
  return joined || tags.fileName?.replace(/\.mp3$/i, '') || 'music'
}

export function escapeQuery(value) {
  return String(value).replace(/"/g, '\\"')
}
