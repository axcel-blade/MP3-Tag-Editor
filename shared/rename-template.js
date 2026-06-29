/** Default filename pattern when auto-rename is enabled. */
export const DEFAULT_RENAME_TEMPLATE = '{artist} - {title}'

const RESERVED_FILENAME_CHARS = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*'])

function removeInvalidFilenameChars(value) {
  return String(value)
    .split('')
    .filter((ch) => {
      const code = ch.charCodeAt(0)
      return code >= 32 && !RESERVED_FILENAME_CHARS.has(ch)
    })
    .join('')
}

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
  return removeInvalidFilenameChars(stem)
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
