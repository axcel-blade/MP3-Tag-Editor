import { describe, it, expect } from 'vitest'
import { findReplaceTags, formatFromTags, copyTags, buildFindPattern } from '../shared/tag-transforms.js'

const tags = { title: 'Song (Remastered 2011)', artist: 'The Band', album: 'Hits', albumArtist: '' }

describe('findReplaceTags', () => {
  it('replaces plain text case-insensitively by default', () => {
    expect(findReplaceTags(tags, { fields: ['artist'], find: 'the ', replace: '' })).toEqual({ artist: 'Band' })
  })

  it('respects case sensitivity', () => {
    expect(findReplaceTags(tags, { fields: ['artist'], find: 'the', caseSensitive: true })).toEqual({})
  })

  it('treats special characters literally without regex', () => {
    expect(findReplaceTags(tags, { fields: ['title'], find: ' (Remastered 2011)', replace: '$1' })).toEqual({
      title: 'Song$1',
    })
  })

  it('supports regex with capture groups', () => {
    expect(
      findReplaceTags(tags, { fields: ['title'], find: '\\s*\\(Remastered (\\d+)\\)', replace: ' [$1]', useRegex: true }),
    ).toEqual({ title: 'Song [2011]' })
  })

  it('only returns changed fields', () => {
    expect(findReplaceTags(tags, { fields: ['title', 'album'], find: 'Hits', replace: 'Best' })).toEqual({ album: 'Best' })
  })

  it('rejects empty and invalid patterns', () => {
    expect(() => buildFindPattern({ find: '' })).toThrow('Enter text to find')
    expect(() => buildFindPattern({ find: '(', useRegex: true })).toThrow('Invalid regular expression')
  })
})

describe('formatFromTags / copyTags', () => {
  it('fills placeholders and blanks unknown ones', () => {
    expect(formatFromTags('{artist} - {album}{nope}', tags)).toBe('The Band - Hits')
  })

  it('copies one field into another', () => {
    expect(copyTags(tags, { target: 'albumArtist', format: '{artist}' })).toEqual({ albumArtist: 'The Band' })
  })

  it('moves a field when clearSource is set', () => {
    expect(copyTags(tags, { target: 'albumArtist', format: '{artist}', clearSource: true })).toEqual({
      albumArtist: 'The Band',
      artist: '',
    })
  })

  it('returns nothing when the target already matches', () => {
    expect(copyTags({ artist: 'X', albumArtist: 'X' }, { target: 'albumArtist', format: '{artist}' })).toEqual({})
  })
})
