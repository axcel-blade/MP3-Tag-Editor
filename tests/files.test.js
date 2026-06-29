import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { findMp3Files } from '../electron/files.js'

describe('findMp3Files', () => {
  let tempDir

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mp3-files-'))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('finds mp3 files recursively and ignores other extensions', async () => {
    await writeFile(join(tempDir, 'a.mp3'), 'a')
    await writeFile(join(tempDir, 'notes.txt'), 'txt')
    const nested = join(tempDir, 'nested')
    await mkdir(nested)
    await writeFile(join(nested, 'b.MP3'), 'b')

    const paths = await findMp3Files(tempDir)
    expect(paths).toHaveLength(2)
    expect(paths[0]).toContain('a.mp3')
    expect(paths[1]).toContain('b.MP3')
  })

  it('returns paths sorted case-insensitively by full path', async () => {
    await writeFile(join(tempDir, 'z.mp3'), 'z')
    await writeFile(join(tempDir, 'a.mp3'), 'a')

    const paths = await findMp3Files(tempDir)
    expect(paths.map((p) => p.split(/[/\\]/).pop())).toEqual(['a.mp3', 'z.mp3'])
  })

  it('returns an empty array for a folder with no mp3 files', async () => {
    await writeFile(join(tempDir, 'readme.txt'), 'hello')
    await expect(findMp3Files(tempDir)).resolves.toEqual([])
  })
})
