import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import NodeID3 from 'node-id3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readMp3Tags, writeMp3Tags } from '../electron/mp3.js'

/** Create a minimal on-disk MP3 with ID3 tags for read/write tests. */
async function createFixtureMp3(dir, tags = {}) {
  const filePath = join(dir, 'fixture.mp3')
  await writeFile(filePath, Buffer.alloc(2048, 0))
  const written = NodeID3.write(
    {
      title: 'Original Title',
      artist: 'Original Artist',
      album: 'Original Album',
      year: '2020',
      genre: 'Test',
      ...tags,
    },
    filePath,
  )
  if (written !== true) {
    throw written instanceof Error ? written : new Error('Failed to seed fixture MP3')
  }
  return filePath
}

describe('readMp3Tags', () => {
  let tempDir

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mp3-tag-editor-'))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('reads seeded title and artist tags', async () => {
    const filePath = await createFixtureMp3(tempDir)
    const tags = await readMp3Tags(filePath)

    expect(tags.title).toBe('Original Title')
    expect(tags.artist).toBe('Original Artist')
    expect(tags.album).toBe('Original Album')
    expect(tags.fileName).toBe('fixture.mp3')
  })

  it('maps album artist from performerInfo', async () => {
    const filePath = await createFixtureMp3(tempDir, { performerInfo: 'Album Artist Name' })
    const tags = await readMp3Tags(filePath)
    expect(tags.albumArtist).toBe('Album Artist Name')
  })
})

describe('writeMp3Tags', () => {
  let tempDir

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mp3-tag-editor-'))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('updates selected fields and preserves unselected tags', async () => {
    const filePath = await createFixtureMp3(tempDir)
    const updated = await writeMp3Tags(filePath, { title: 'New Title', artist: 'New Artist' }, false, null)

    expect(updated.title).toBe('New Title')
    expect(updated.artist).toBe('New Artist')
    expect(updated.album).toBe('Original Album')
  })

  it('throws when no fields are selected', async () => {
    const filePath = await createFixtureMp3(tempDir)
    await expect(writeMp3Tags(filePath, {}, false, null)).rejects.toThrow(/No tags selected/)
  })

  it('writes unsynchronised lyrics', async () => {
    const filePath = await createFixtureMp3(tempDir)
    const updated = await writeMp3Tags(
      filePath,
      { lyrics: 'Line one\nLine two' },
      false,
      null,
    )

    expect(updated.lyrics).toContain('Line one')
  })

  it('writes album artist to performerInfo', async () => {
    const filePath = await createFixtureMp3(tempDir)
    const updated = await writeMp3Tags(filePath, { albumArtist: 'Various Artists' }, false, null)
    expect(updated.albumArtist).toBe('Various Artists')
  })

  it('embeds artwork when includeArtwork is true', async () => {
    const filePath = await createFixtureMp3(tempDir)
    const imageBytes = Buffer.from('fake-image-bytes')

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        headers: { get: () => 'image/png' },
        arrayBuffer: async () => imageBytes.buffer.slice(
          imageBytes.byteOffset,
          imageBytes.byteOffset + imageBytes.byteLength,
        ),
      })),
    )

    const updated = await writeMp3Tags(
      filePath,
      { title: 'Original Title' },
      true,
      'https://example.com/cover.png',
    )

    expect(updated.picture?.mime).toBe('image/png')
    expect(updated.picture?.data).toBeTruthy()
    vi.unstubAllGlobals()
  })

  it('throws when artwork download fails', async () => {
    const filePath = await createFixtureMp3(tempDir)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })))

    await expect(
      writeMp3Tags(filePath, { title: 'Original Title' }, true, 'https://example.com/missing.png'),
    ).rejects.toThrow(/Failed to download artwork/)

    vi.unstubAllGlobals()
  })
})
