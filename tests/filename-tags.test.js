import { describe, it, expect } from 'vitest'
import { compileFilenamePattern, parseTagsFromFilename, filenameTagChanges } from '../shared/filename-tags.js'

const KEYS = ['title', 'artist', 'album', 'year', 'trackNumber']

describe('parseTagsFromFilename', () => {
  it('parses a simple pattern', () => {
    const compiled = compileFilenamePattern('{trackNumber} - {artist} - {title}', KEYS)
    expect(parseTagsFromFilename(compiled, 'C:\\Music\\03 - The Band - Song Name.mp3')).toEqual({
      trackNumber: '03',
      artist: 'The Band',
      title: 'Song Name',
    })
  })

  it('keeps separators inside the last field', () => {
    const compiled = compileFilenamePattern('{artist} - {title}', KEYS)
    expect(parseTagsFromFilename(compiled, '/m/A - B - C.mp3')).toEqual({ artist: 'A', title: 'B - C' })
  })

  it('reads folder names when the pattern has separators', () => {
    const compiled = compileFilenamePattern('{artist}\\{album}\\{title}', KEYS)
    expect(parseTagsFromFilename(compiled, 'C:/Music/Artist X/Album Y/Track.mp3')).toEqual({
      artist: 'Artist X',
      album: 'Album Y',
      title: 'Track',
    })
  })

  it('supports {ignore} and literal special characters', () => {
    const compiled = compileFilenamePattern('[{year}] {ignore}. {title}', KEYS)
    expect(parseTagsFromFilename(compiled, '[1999] 01. Song (Live).mp3')).toEqual({ year: '1999', title: 'Song (Live)' })
  })

  it('returns null when the name does not match', () => {
    const compiled = compileFilenamePattern('{artist} - {title}', KEYS)
    expect(parseTagsFromFilename(compiled, 'JustATitle.mp3')).toBeNull()
  })

  it('rejects empty patterns, unknown placeholders and patterns without placeholders', () => {
    expect(() => compileFilenamePattern('', KEYS)).toThrow('Enter a filename pattern')
    expect(() => compileFilenamePattern('{nope}', KEYS)).toThrow('Unknown placeholder {nope}')
    expect(() => compileFilenamePattern('plain', KEYS)).toThrow('at least one placeholder')
  })
})

describe('filenameTagChanges', () => {
  it('returns only fields that differ from current tags', () => {
    const compiled = compileFilenamePattern('{artist} - {title}', KEYS)
    expect(filenameTagChanges(compiled, 'A - B.mp3', { artist: 'A', title: 'Old' })).toEqual({ title: 'B' })
    expect(filenameTagChanges(compiled, 'nomatch.mp3', {})).toEqual({})
  })
})
