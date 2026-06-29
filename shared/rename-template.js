/** Default filename pattern when auto-rename is enabled. */
export const DEFAULT_RENAME_TEMPLATE = '{artist} - {title}'

const INVALID_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g

export function applyRenameTemplate(template, tags, originalBaseName = '') {
  let result = template
  const values = {
    title: tags.title ?? '',
    artist: tags.artist ?? '',
    album: tags.album ?? '',
    year: tags.year ?? '',
    genre: tags.genre ?? '',
    trackNumber: tags.trackNumber ?? '',
    albumArtist: tags.albumArtist ?? '',
    track: tags.trackNumber ?? '',
    filename: originalBaseName,
  }

  for (const [key, value] of Object.entries(values)) {
    result = result.replaceAll(new RegExp(`\\{${key}\\}`, 'gi'), value)
  }

  result = result.replace(/\{[^}]+\}/g, '')
  return result
}

export function sanitizeFilename(stem) {
  return stem
    .replace(INVALID_CHARS, '')
    .replace(/\s+/g, ' ')
    .replace(/[.\s]+$/g, '')
    .trim()
}

export function buildRenameFilename(template, tags, originalBaseName = 'song') {
  const raw = applyRenameTemplate(template || DEFAULT_RENAME_TEMPLATE, tags, originalBaseName)
  const stem = sanitizeFilename(raw) || originalBaseName
  return `${stem}.mp3`
}

export const RENAME_PLACEHOLDERS = [
  '{artist}',
  '{title}',
  '{album}',
  '{year}',
  '{genre}',
  '{trackNumber}',
  '{track}',
  '{albumArtist}',
  '{filename}',
]
