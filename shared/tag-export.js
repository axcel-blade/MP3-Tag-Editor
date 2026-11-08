/** Export formats offered in the UI, with the file extension the save dialog uses. */
export const EXPORT_FORMATS = [
  { key: 'csv', label: 'CSV', extension: 'csv' },
  { key: 'html', label: 'HTML', extension: 'html' },
  { key: 'json', label: 'JSON', extension: 'json' },
]

function csvCell(value) {
  const text = String(value ?? '')
  // Quote when needed; prefix formula-like values so spreadsheets don't execute them.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Build an export document.
 * entries: [{ path, tags }]; fields: [{ key, label }].
 * Columns are File, the given fields, then Path.
 */
export function buildTagExport(format, entries, fields, { title = 'MP3 Tag Report' } = {}) {
  const columns = [
    { key: 'fileName', label: 'File', get: (e) => e.tags?.fileName ?? String(e.path).split(/[\\/]/).pop() },
    ...fields.map(({ key, label }) => ({ key, label, get: (e) => e.tags?.[key] ?? '' })),
    { key: 'path', label: 'Path', get: (e) => e.path },
  ]

  switch (format) {
    case 'csv': {
      const lines = [columns.map((c) => csvCell(c.label)).join(',')]
      for (const entry of entries) lines.push(columns.map((c) => csvCell(c.get(entry))).join(','))
      // BOM so Excel opens UTF-8 (non-Latin titles) correctly.
      return `\uFEFF${lines.join('\r\n')}\r\n`
    }
    case 'json':
      return `${JSON.stringify(
        entries.map((entry) => Object.fromEntries(columns.map((c) => [c.key, c.get(entry)]))),
        null,
        2,
      )}\n`
    case 'html': {
      const head = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('')
      const rows = entries
        .map((entry) => `<tr>${columns.map((c) => `<td>${escapeHtml(c.get(entry))}</td>`).join('')}</tr>`)
        .join('\n')
      return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
body { font-family: system-ui, sans-serif; margin: 1.5rem; color: #222; }
table { border-collapse: collapse; width: 100%; font-size: 0.85rem; }
th, td { border: 1px solid #ccc; padding: 0.35rem 0.5rem; text-align: left; }
th { background: #f2f2f2; position: sticky; top: 0; }
tr:nth-child(even) td { background: #fafafa; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p>${entries.length} file${entries.length === 1 ? '' : 's'}</p>
<table>
<thead><tr>${head}</tr></thead>
<tbody>
${rows}
</tbody>
</table>
</body>
</html>
`
    }
    default:
      throw new Error(`Unknown export format: ${format}`)
  }
}

/**
 * Filter files by a query. Plain words match the filename or any tag value;
 * "field:value" (e.g. artist:beatles, year:1999) matches one field. All terms must match.
 * Use quotes for spaces: album:"abbey road". tagsByPath may be missing entries (filename only).
 */
export function filterFiles(paths, query, tagsByPath = {}, fieldKeys = []) {
  const terms = [...String(query ?? '').matchAll(/(\w+):"([^"]*)"|(\w+):(\S+)|"([^"]*)"|(\S+)/g)].map((m) => {
    const field = m[1] ?? m[3]
    const value = (m[2] ?? m[4] ?? m[5] ?? m[6] ?? '').toLowerCase()
    return field && fieldKeys.includes(field) ? { field, value } : { field: null, value: field ? `${field}:${value}` : value }
  })
  if (terms.length === 0) return paths

  return paths.filter((path) => {
    const tags = tagsByPath[path]
    const name = String(path).split(/[\\/]/).pop().toLowerCase()
    return terms.every(({ field, value }) => {
      if (field) return String(tags?.[field] ?? '').toLowerCase().includes(value)
      if (name.includes(value)) return true
      return fieldKeys.some((key) => String(tags?.[key] ?? '').toLowerCase().includes(value))
    })
  })
}
