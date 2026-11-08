import { copyFile, mkdtemp, rm } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  readAudioTags,
  writeAudioTags,
  readAudioCover,
  writeAudioCover,
  removeAudioCover,
  parsePosition,
  toTaglibInput,
} from '../electron/audio.js'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')
let tempDir

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'audio-test-'))
})

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true })
})

async function fixture(ext) {
  const filePath = join(tempDir, `${ext}-${Math.random().toString(36).slice(2)}.${ext}`)
  await copyFile(join(FIXTURES, `silence.${ext}`), filePath)
  return filePath
}

describe('parsePosition / toTaglibInput', () => {
  it('parses track and disc positions', () => {
    expect(parsePosition('03', 'Track')).toEqual({ number: 3, total: 0 })
    expect(parsePosition('3 / 12', 'Track')).toEqual({ number: 3, total: 12 })
    expect(parsePosition('', 'Track')).toEqual({ number: 0, total: 0 })
    expect(() => parsePosition('three', 'Track number')).toThrow('Track number must be a number')
  })

  it('maps app fields to TagLib input', () => {
    expect(toTaglibInput({ title: 'T', year: '1999', trackNumber: '2/9', lyrics: '' })).toEqual({
      title: 'T',
      year: 1999,
      track: 2,
      totalTracks: 9,
      lyrics: [],
    })
    expect(toTaglibInput({ year: '1999-05-01' })).toEqual({ date: '1999-05-01' })
  })
})

describe.each(['flac', 'm4a', 'ogg'])('%s tags', (ext) => {
  it('writes and reads back every field', async () => {
    const filePath = await fixture(ext)
    const tags = await writeAudioTags(
      filePath,
      {
        title: 'Tïtle',
        artist: 'Artist',
        album: 'Album',
        year: '1999',
        genre: 'Pop',
        trackNumber: '3/12',
        discNumber: '1/2',
        albumArtist: 'Various',
        lyrics: 'line one\nline two',
      },
      false,
      null,
    )
    expect(tags).toMatchObject({
      title: 'Tïtle',
      artist: 'Artist',
      album: 'Album',
      year: '1999',
      genre: 'Pop',
      trackNumber: '3/12',
      discNumber: '1/2',
      albumArtist: 'Various',
      lyrics: 'line one\nline two',
      fileName: filePath.split(/[\\/]/).pop(),
    })
    expect(await readAudioTags(filePath)).toMatchObject({ title: 'Tïtle', trackNumber: '3/12' })
  })

  it('only changes the fields given', async () => {
    const filePath = await fixture(ext)
    await writeAudioTags(filePath, { title: 'Keep', artist: 'Old' }, false, null)
    const tags = await writeAudioTags(filePath, { artist: 'New' }, false, null)
    expect(tags.title).toBe('Keep')
    expect(tags.artist).toBe('New')
  })

  it('clears fields set to empty', async () => {
    const filePath = await fixture(ext)
    await writeAudioTags(filePath, { title: 'X', trackNumber: '4', year: '2001' }, false, null)
    const tags = await writeAudioTags(filePath, { title: '', trackNumber: '', year: '' }, false, null)
    expect(tags).toMatchObject({ title: '', trackNumber: '', year: '' })
  })

  it('sets, exports and removes cover art', async () => {
    const filePath = await fixture(ext)
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
    await writeAudioTags(filePath, { title: 'With cover' }, false, null)

    const withCover = await writeAudioCover(filePath, { mime: 'image/png', buffer: png })
    expect(withCover.picture?.mime).toBe('image/png')
    expect((await readAudioCover(filePath))?.buffer.equals(png)).toBe(true)

    const removed = await removeAudioCover(filePath)
    expect(removed.picture).toBeNull()
    expect(removed.title).toBe('With cover')
  })
})

describe('unsupported files', () => {
  it('rejects unknown extensions', async () => {
    await expect(readAudioTags('/tmp/notes.txt')).rejects.toThrow('Unsupported file type')
  })
})
