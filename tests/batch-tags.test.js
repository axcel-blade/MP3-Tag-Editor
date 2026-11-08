import { describe, it, expect } from 'vitest'
import { mergeTags, createBatchDraft, buildBatchChanges } from '../shared/batch-tags.js'

const KEYS = ['title', 'artist', 'album']

describe('mergeTags', () => {
  it('reports shared and mixed values', () => {
    const merged = mergeTags(
      [
        { title: 'A', artist: 'X', album: 'Same' },
        { title: 'B', artist: 'X', album: 'Same' },
      ],
      KEYS,
    )
    expect(merged.title).toEqual({ value: '', mixed: true })
    expect(merged.artist).toEqual({ value: 'X', mixed: false })
  })

  it('treats missing values as empty strings', () => {
    const merged = mergeTags([{ title: '' }, {}], KEYS)
    expect(merged.title).toEqual({ value: '', mixed: false })
  })
})

describe('createBatchDraft / buildBatchChanges', () => {
  const merged = mergeTags(
    [
      { title: 'A', artist: 'X', album: '' },
      { title: 'B', artist: 'X', album: '' },
    ],
    KEYS,
  )

  it('starts with null for mixed fields', () => {
    expect(createBatchDraft(merged)).toEqual({ title: null, artist: 'X', album: '' })
  })

  it('returns no changes for an untouched draft', () => {
    expect(buildBatchChanges(createBatchDraft(merged), merged)).toEqual({})
  })

  it('writes edited shared fields and overridden mixed fields', () => {
    const draft = { title: 'Same title', artist: 'Y', album: '' }
    expect(buildBatchChanges(draft, merged)).toEqual({ title: 'Same title', artist: 'Y' })
  })

  it('allows clearing a mixed field to empty', () => {
    expect(buildBatchChanges({ title: '', artist: 'X', album: '' }, merged)).toEqual({ title: '' })
  })
})
