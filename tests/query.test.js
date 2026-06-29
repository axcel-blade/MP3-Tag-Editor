import { describe, expect, it } from 'vitest'
import { buildSearchQuery, escapeQuery } from '../electron/metadata/query.js'

describe('buildSearchQuery', () => {
  it('joins title, artist, and album from tag objects', () => {
    expect(
      buildSearchQuery({ title: 'Help!', artist: 'Beatles', album: 'Help!' }),
    ).toBe('Help! Beatles Help!')
  })

  it('uses a trimmed string input as-is', () => {
    expect(buildSearchQuery('  custom query  ')).toBe('custom query')
  })

  it('falls back to filename without extension when tags are empty', () => {
    expect(buildSearchQuery({ fileName: 'My Song.mp3' })).toBe('My Song')
  })

  it('falls back to "music" when nothing else is available', () => {
    expect(buildSearchQuery({})).toBe('music')
  })
})

describe('escapeQuery', () => {
  it('escapes double quotes for Lucene-style queries', () => {
    expect(escapeQuery('say "hello"')).toBe('say \\"hello\\"')
  })
})
