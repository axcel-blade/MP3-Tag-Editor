/** Placeholder shown for a field whose value differs across the selected files. */
export const KEEP_PLACEHOLDER = '<keep>'

/**
 * Merge tags from several files into one view.
 * Returns { [key]: { value, mixed } } — value is the shared value, or '' when mixed.
 */
export function mergeTags(tagsList, fieldKeys) {
  const merged = {}
  for (const key of fieldKeys) {
    const values = new Set(tagsList.map((tags) => tags?.[key] ?? ''))
    const mixed = values.size > 1
    merged[key] = { value: mixed ? '' : ([...values][0] ?? ''), mixed }
  }
  return merged
}

/** Initial draft for batch editing: shared values, mixed fields left untouched (null). */
export function createBatchDraft(merged) {
  return Object.fromEntries(
    Object.entries(merged).map(([key, { value, mixed }]) => [key, mixed ? null : value]),
  )
}

/**
 * Fields to write to every selected file.
 * A null draft value means "keep each file's own value"; otherwise a field is
 * written only when it differs from the shared value (or was mixed).
 */
export function buildBatchChanges(draft, merged) {
  const changes = {}
  for (const [key, next] of Object.entries(draft)) {
    if (next === null || next === undefined) continue
    const current = merged[key]
    if (!current) continue
    if (current.mixed || next !== current.value) changes[key] = next
  }
  return changes
}
