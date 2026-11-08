/**
 * Build an extended M3U playlist (UTF-8, use the .m3u8 extension).
 * items: [{ location, title, durationSec }] — location is written as given (relative or absolute).
 */
export function formatM3U(items) {
  const lines = ['#EXTM3U']
  for (const { location, title, durationSec } of items) {
    const seconds = Number.isFinite(durationSec) && durationSec > 0 ? Math.round(durationSec) : -1
    const label = String(title ?? '').replace(/[\r\n]+/g, ' ').trim()
    if (label) lines.push(`#EXTINF:${seconds},${label}`)
    lines.push(String(location).replace(/[\r\n]+/g, ''))
  }
  return `${lines.join('\n')}\n`
}

/**
 * Read entry locations from M3U/M3U8 text, in order.
 * Comment and directive lines (#...) and blank lines are skipped; file:// URLs are decoded.
 */
export function parseM3U(text) {
  return String(text ?? '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      if (!/^file:\/\//i.test(line)) return line
      try {
        const decoded = decodeURIComponent(line.replace(/^file:\/\//i, ''))
        // file:///C:/x → C:/x on Windows-style drives, keep the leading slash elsewhere.
        return /^\/[A-Za-z]:\//.test(decoded) ? decoded.slice(1) : decoded
      } catch {
        return line
      }
    })
}

/** "Artist - Title" label for #EXTINF, falling back to the filename. */
export function playlistTitle(tags, fallback) {
  const artist = String(tags?.artist ?? '').trim()
  const title = String(tags?.title ?? '').trim()
  if (artist && title) return `${artist} - ${title}`
  return title || fallback
}
