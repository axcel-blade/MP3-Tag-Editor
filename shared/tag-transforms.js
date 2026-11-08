function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Build the RegExp used by find & replace.
 * Throws a readable error when a user-supplied regular expression is invalid.
 */
export function buildFindPattern({ find, useRegex = false, caseSensitive = false }) {
  if (!find) throw new Error('Enter text to find')
  const flags = caseSensitive ? 'g' : 'gi'
  try {
    return new RegExp(useRegex ? find : escapeRegExp(find), flags)
  } catch (err) {
    throw new Error(`Invalid regular expression: ${err.message}`, { cause: err })
  }
}

/**
 * Find & replace in the given fields of one file's tags.
 * Returns only the fields whose value actually changes.
 * With useRegex, the replacement may use $1, $2… capture groups.
 */
export function findReplaceTags(tags, { fields, find, replace = '', useRegex = false, caseSensitive = false }) {
  const pattern = buildFindPattern({ find, useRegex, caseSensitive })
  const replacement = useRegex ? replace : replace.replace(/\$/g, '$$$$')
  const changes = {}
  for (const key of fields) {
    const before = String(tags?.[key] ?? '')
    const after = before.replace(pattern, replacement)
    if (after !== before) changes[key] = after
  }
  return changes
}

/** Fill {field} placeholders in a format string from one file's tags. Unknown placeholders become ''. */
export function formatFromTags(template, tags) {
  return template.replace(/\{([^}]+)\}/g, (_match, key) => String(tags?.[key.trim()] ?? ''))
}

/**
 * Tag-to-tag: set `target` from a format string such as "{artist}" or "{artist} - {album}".
 * With clearSource, the source fields used in the format (other than the target) are emptied — a "move".
 * Returns only fields whose value changes.
 */
export function copyTags(tags, { target, format, clearSource = false }) {
  if (!target) throw new Error('Choose a target field')
  if (!format) throw new Error('Enter a source format, e.g. {artist}')

  const changes = {}
  const next = formatFromTags(format, tags).trim()
  if (next !== String(tags?.[target] ?? '')) changes[target] = next

  if (clearSource) {
    for (const [, key] of format.matchAll(/\{([^}]+)\}/g)) {
      const source = key.trim()
      if (source !== target && String(tags?.[source] ?? '') !== '') changes[source] = ''
    }
  }
  return changes
}
