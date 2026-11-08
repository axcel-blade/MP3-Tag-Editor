/** Placeholder that matches text without storing it, e.g. "{ignore} - {title}". */
export const IGNORE_PLACEHOLDER = 'ignore'

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Compile a pattern like "{trackNumber} - {artist} - {title}" into a matcher.
 * A "/" or "\" in the pattern matches folder separators, so "{artist}\{album}\{title}"
 * reads tags from the last folders as well as the filename.
 */
export function compileFilenamePattern(pattern, allowedKeys) {
  const source = String(pattern ?? '').trim()
  if (!source) throw new Error('Enter a filename pattern, e.g. {artist} - {title}')

  const keys = []
  let regex = ''
  let lastIndex = 0
  for (const match of source.matchAll(/\{([^}]+)\}/g)) {
    const key = match[1].trim()
    if (key !== IGNORE_PLACEHOLDER && !allowedKeys.includes(key)) {
      throw new Error(`Unknown placeholder {${key}}`)
    }
    regex += escapeRegExp(source.slice(lastIndex, match.index)).replace(/\\\\|\//g, '[\\\\/]')
    regex += '(.+?)'
    keys.push(key)
    lastIndex = match.index + match[0].length
  }
  regex += escapeRegExp(source.slice(lastIndex)).replace(/\\\\|\//g, '[\\\\/]')

  if (keys.length === 0) throw new Error('The pattern needs at least one placeholder, e.g. {title}')

  const separators = (source.match(/[\\/]/g) ?? []).length
  return { regex: new RegExp(`^${regex}$`), keys, separators }
}

/**
 * Read tag values from a file path using a compiled pattern.
 * Returns { [key]: value } (trimmed), or null when the name does not fit the pattern.
 */
export function parseTagsFromFilename(compiled, filePath) {
  const segments = String(filePath).split(/[\\/]/)
  const name = segments.pop() ?? ''
  const stem = name.replace(/\.[^.]+$/, '')
  if (segments.length < compiled.separators) return null
  const subject = [...segments.slice(segments.length - compiled.separators), stem].join('/')

  const match = compiled.regex.exec(subject)
  if (!match) return null

  const tags = {}
  compiled.keys.forEach((key, i) => {
    if (key !== IGNORE_PLACEHOLDER) tags[key] = match[i + 1].trim()
  })
  return tags
}

/** Fields that parsing would change for one file, compared with its current tags. */
export function filenameTagChanges(compiled, filePath, currentTags) {
  const parsed = parseTagsFromFilename(compiled, filePath)
  if (!parsed) return {}
  const changes = {}
  for (const [key, value] of Object.entries(parsed)) {
    if (value !== String(currentTags?.[key] ?? '')) changes[key] = value
  }
  return changes
}
