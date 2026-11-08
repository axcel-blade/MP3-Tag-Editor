import { describe, it, expect } from 'vitest'
import { addActionStep, describeStep, pickStepOptions, runAction, sanitizeActions } from '../shared/actions.js'

const KEYS = ['title', 'artist', 'album', 'albumArtist', 'trackNumber']

describe('pickStepOptions', () => {
  it('keeps only the options a mode uses, with the right types', () => {
    expect(pickStepOptions('copy', { target: 'albumArtist', format: '{artist}', find: 'x', clearSource: 1 })).toEqual({
      target: 'albumArtist',
      format: '{artist}',
      clearSource: true,
    })
    expect(() => pickStepOptions('rename', {})).toThrow("can't be saved")
  })
})

describe('addActionStep / sanitizeActions', () => {
  it('creates an action, then appends steps to it', () => {
    let actions = addActionStep([], ' Clean up ', 'replace', { find: 'feat.', replace: 'ft.', fields: ['title'] })
    actions = addActionStep(actions, 'Clean up', 'copy', { target: 'albumArtist', format: '{artist}' })
    expect(actions).toHaveLength(1)
    expect(actions[0].name).toBe('Clean up')
    expect(actions[0].steps.map((s) => s.mode)).toEqual(['replace', 'copy'])
    expect(() => addActionStep(actions, '  ', 'copy', {})).toThrow('Enter an action name')
  })

  it('drops malformed entries, unknown modes and duplicate names', () => {
    expect(
      sanitizeActions([
        { name: 'A', steps: [{ mode: 'copy', options: { target: 'title', format: '{album}' } }, { mode: 'evil' }] },
        { name: 'A', steps: [{ mode: 'copy', options: {} }] },
        { name: '', steps: [{ mode: 'copy' }] },
        { name: 'Empty', steps: [] },
        'junk',
      ]),
    ).toEqual([{ name: 'A', steps: [{ mode: 'copy', options: { target: 'title', format: '{album}', clearSource: false } }] }])
    expect(sanitizeActions(null)).toEqual([])
  })
})

describe('runAction', () => {
  const action = {
    name: 'Tidy',
    steps: [
      { mode: 'filename', options: { filenamePattern: '{trackNumber} - {artist} - {title}' } },
      { mode: 'replace', options: { fields: ['title'], find: ' (Remastered)', replace: '', useRegex: false, caseSensitive: false } },
      { mode: 'copy', options: { target: 'albumArtist', format: '{artist}', clearSource: false } },
    ],
  }

  it('chains steps and returns only the net changes', () => {
    const tags = { title: 'old', artist: 'Band', album: 'LP', albumArtist: '', trackNumber: '' }
    expect(runAction(action, '/m/03 - Band - Song (Remastered).flac', tags, KEYS)).toEqual({
      title: 'Song',
      trackNumber: '03',
      albumArtist: 'Band',
    })
  })

  it('returns nothing when the file is already tidy', () => {
    const tags = { title: 'Song', artist: 'Band', album: 'LP', albumArtist: 'Band', trackNumber: '03' }
    expect(runAction(action, '/m/03 - Band - Song.flac', tags, KEYS)).toEqual({})
  })

  it('describes steps', () => {
    expect(action.steps.map(describeStep)).toEqual([
      'Tags from filename: {trackNumber} - {artist} - {title}',
      'Replace " (Remastered)" → ""',
      'Copy {artist} → albumArtist',
    ])
  })
})
