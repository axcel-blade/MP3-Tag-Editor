import { describe, it, expect } from 'vitest'
import { autoNumberTracks } from '../shared/auto-number.js'

const entry = (path, tags = {}) => ({ path, tags })
const changesOf = (rows) => rows.map((r) => r.changes)

describe('autoNumberTracks', () => {
  const files = [
    entry('/m/CD1/a.mp3', { album: 'X' }),
    entry('/m/CD1/b.mp3', { album: 'X' }),
    entry('/m/CD2/c.mp3', { album: 'Y' }),
  ]

  it('numbers sequentially with padding', () => {
    expect(changesOf(autoNumberTracks(files, { padding: 2 }))).toEqual([
      { trackNumber: '01' },
      { trackNumber: '02' },
      { trackNumber: '03' },
    ])
  })

  it('supports a custom start and "n/total"', () => {
    expect(changesOf(autoNumberTracks(files, { start: 5, includeTotal: true }))).toEqual([
      { trackNumber: '5/7' },
      { trackNumber: '6/7' },
      { trackNumber: '7/7' },
    ])
  })

  it('resets per folder and numbers discs', () => {
    expect(changesOf(autoNumberTracks(files, { resetBy: 'folder', includeTotal: true, numberDiscs: true }))).toEqual([
      { trackNumber: '1/2', discNumber: '1/2' },
      { trackNumber: '2/2', discNumber: '1/2' },
      { trackNumber: '1/1', discNumber: '2/2' },
    ])
  })

  it('resets when the album changes', () => {
    expect(changesOf(autoNumberTracks(files, { resetBy: 'album' })).map((c) => c.trackNumber)).toEqual(['1', '2', '1'])
  })

  it('skips fields that already match', () => {
    expect(autoNumberTracks([entry('/a.mp3', { trackNumber: '1' })])[0].changes).toEqual({})
  })

  it('rejects invalid input', () => {
    expect(() => autoNumberTracks(files, { start: -1 })).toThrow('Start number')
    expect(() => autoNumberTracks(files, { resetBy: 'genre' })).toThrow('Unknown reset mode')
  })
})
