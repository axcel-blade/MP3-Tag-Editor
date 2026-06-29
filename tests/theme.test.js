import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  THEME_MODES,
  normalizeThemeMode,
  resolveTheme,
  applyTheme,
} from '../src/theme.js'

describe('normalizeThemeMode', () => {
  it('accepts valid theme modes', () => {
    expect(normalizeThemeMode('dark')).toBe('dark')
    expect(normalizeThemeMode('light')).toBe('light')
    expect(normalizeThemeMode('system')).toBe('system')
  })

  it('defaults invalid values to system', () => {
    expect(normalizeThemeMode('neon')).toBe('system')
    expect(normalizeThemeMode(null)).toBe('system')
  })
})

describe('resolveTheme', () => {
  it('returns explicit light and dark modes', () => {
    expect(resolveTheme('light')).toBe('light')
    expect(resolveTheme('dark')).toBe('dark')
  })

  it('uses provided system theme when mode is system', () => {
    expect(resolveTheme('system', 'light')).toBe('light')
    expect(resolveTheme('system', 'dark')).toBe('dark')
  })

  it('defaults to dark in node when system theme is unknown', () => {
    expect(resolveTheme('system')).toBe('dark')
  })
})

describe('applyTheme', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sets data-theme on the document element', () => {
    const setAttribute = vi.fn()
    vi.stubGlobal('document', {
      documentElement: { setAttribute },
    })

    applyTheme('dark')
    expect(setAttribute).toHaveBeenCalledWith('data-theme', 'dark')
  })

  it('exposes all supported theme modes', () => {
    expect(THEME_MODES).toEqual(['system', 'dark', 'light'])
  })
})
