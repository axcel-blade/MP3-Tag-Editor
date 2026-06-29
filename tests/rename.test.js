import { describe, expect, it } from 'vitest'
import {
  applyRenameTemplate,
  buildRenameFilename,
  sanitizeFilename,
} from '../shared/rename-template.js'

describe('applyRenameTemplate', () => {
  it('replaces tag placeholders', () => {
    const result = applyRenameTemplate('{artist} - {title}', {
      artist: 'Beatles',
      title: 'Help!',
    })
    expect(result).toBe('Beatles - Help!')
  })

  it('supports track alias and strips unknown placeholders', () => {
    const result = applyRenameTemplate('{track}. {title} ({unknown})', {
      trackNumber: '5',
      title: 'Song',
    })
    expect(result).toBe('5. Song ()')
  })
})

describe('sanitizeFilename', () => {
  it('removes invalid path characters', () => {
    expect(sanitizeFilename('Artist: Live / "Special"')).toBe('Artist Live Special')
  })
})

describe('buildRenameFilename', () => {
  it('appends .mp3 extension', () => {
    expect(
      buildRenameFilename('{artist} - {title}', { artist: 'A', title: 'B' }, 'old'),
    ).toBe('A - B.mp3')
  })

  it('falls back to original base when template resolves empty', () => {
    expect(buildRenameFilename('{artist}', {}, 'fallback-name')).toBe('fallback-name.mp3')
  })
})
