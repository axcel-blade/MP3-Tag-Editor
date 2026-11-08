/** Ways to restart the track counter while numbering. */
export const RESET_MODES = ['none', 'folder', 'album']

function folderOf(filePath) {
  const parts = String(filePath).split(/[\\/]/)
  parts.pop()
  return parts.join('/')
}

function groupKey(entry, resetBy) {
  if (resetBy === 'folder') return folderOf(entry.path)
  if (resetBy === 'album') return String(entry.tags?.album ?? '')
  return ''
}

function formatNumber(value, total, { padding, includeTotal }) {
  const width = Math.max(0, Number(padding) || 0)
  const pad = (n) => String(n).padStart(width, '0')
  return includeTotal ? `${pad(value)}/${pad(total)}` : pad(value)
}

/**
 * Auto-number tracks (and optionally discs) across files in list order.
 * entries: [{ path, tags }]
 * options: { start, padding, includeTotal, resetBy: 'none'|'folder'|'album', numberDiscs }
 * The counter restarts each time the reset key changes. With numberDiscs, each
 * group gets the next disc number (1, 2, …) — e.g. one folder per disc.
 * Returns [{ path, tags, changes }] where changes holds only differing fields.
 */
export function autoNumberTracks(entries, options = {}) {
  const { start = 1, resetBy = 'none', numberDiscs = false } = options
  const first = Number.parseInt(start, 10)
  if (!Number.isFinite(first) || first < 0) throw new Error('Start number must be 0 or more')
  if (!RESET_MODES.includes(resetBy)) throw new Error(`Unknown reset mode: ${resetBy}`)

  // Split into consecutive groups so totals and disc numbers follow list order.
  const groups = []
  for (const entry of entries) {
    const key = groupKey(entry, resetBy)
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.items.push(entry)
    else groups.push({ key, items: [entry] })
  }

  const discTotal = groups.length
  return groups.flatMap((group, groupIndex) =>
    group.items.map((entry, i) => {
      const changes = {}
      const lastTrack = first + group.items.length - 1
      const track = formatNumber(first + i, lastTrack, options)
      if (track !== String(entry.tags?.trackNumber ?? '')) changes.trackNumber = track
      if (numberDiscs) {
        const disc = formatNumber(groupIndex + 1, discTotal, { ...options, padding: 0 })
        if (disc !== String(entry.tags?.discNumber ?? '')) changes.discNumber = disc
      }
      return { ...entry, changes }
    }),
  )
}
