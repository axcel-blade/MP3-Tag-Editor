/** User-selectable theme modes stored in app settings. */
export const THEME_MODES = ['system', 'dark', 'light']

export const THEME_OPTIONS = [
  { value: 'system', label: 'System', hint: 'Follow your device light/dark setting' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
]

/** Normalize persisted theme value. */
export function normalizeThemeMode(value) {
  if (value === 'light' || value === 'dark' || value === 'system') return value
  return 'system'
}

/** Resolve system/dark/light preference to an applied data-theme value. */
export function resolveTheme(mode, systemTheme = null) {
  if (mode === 'light' || mode === 'dark') return mode
  if (systemTheme === 'light' || systemTheme === 'dark') return systemTheme
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'dark'
}

export function applyTheme(mode, systemTheme = null) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', resolveTheme(mode, systemTheme))
}
