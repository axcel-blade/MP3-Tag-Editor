import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renameMp3File, previewRename, maxStemLengthForDir } from '../electron/rename.js'
import {
  applyRenameTemplate,
  buildRenameFilename,
  sanitizeFilename,
  truncateFilenameStem,
  MAX_FILENAME_STEM_LENGTH,
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

describe('truncateFilenameStem', () => {
  it('shortens very long artist lists for Windows paths', () => {
    const longArtist = 'A'.repeat(200)
    const truncated = truncateFilenameStem(`${longArtist} - Title`, 120)
    expect(truncated.length).toBeLessThanOrEqual(120)
    expect(truncated.length).toBeGreaterThan(0)
  })
})

describe('maxStemLengthForDir', () => {
  it('reduces stem length for deep directory paths', () => {
    const deepDir = `C:\\Users\\test\\${'nested\\'.repeat(20)}`
    expect(maxStemLengthForDir(deepDir)).toBeLessThan(MAX_FILENAME_STEM_LENGTH)
    expect(maxStemLengthForDir(deepDir)).toBeGreaterThanOrEqual(32)
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

  it('includes filename placeholder from the original base name', () => {
    expect(
      buildRenameFilename('{filename}', { title: 'Ignored' }, 'original-song'),
    ).toBe('original-song.mp3')
  })

  it('truncates extremely long template output', () => {
    const manyArtists = Array.from({ length: 20 }, (_, i) => `Artist ${i}`).join(', ')
    const fileName = buildRenameFilename(
      '{artist} - {title}',
      { artist: manyArtists, title: 'Sthuthi Sri Lanka' },
      'original',
      { maxStemLength: 80 },
    )
    expect(fileName.endsWith('.mp3')).toBe(true)
    expect(fileName.length).toBeLessThanOrEqual(84)
  })
})

describe('previewRename', () => {
  it('previews the target filename without touching disk', () => {
    expect(
      previewRename('{artist} - {title}', { artist: 'A', title: 'B' }, 'old-name.mp3'),
    ).toBe('A - B.mp3')
  })
})

describe('renameMp3File', () => {
  let tempDir

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mp3-rename-'))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('returns the new path after renaming', async () => {
    const sourcePath = join(tempDir, 'original.mp3')
    await writeFile(sourcePath, Buffer.from('mp3'))

    const renamedPath = await renameMp3File(
      sourcePath,
      { artist: 'Artist', title: 'Title' },
      '{artist} - {title}',
    )

    expect(renamedPath).toBe(join(tempDir, 'Artist - Title.mp3'))
    await expect(readFile(renamedPath)).resolves.toBeDefined()
  })

  it('returns the original path when the target name is unchanged', async () => {
    const sourcePath = join(tempDir, 'Artist - Title.mp3')
    await writeFile(sourcePath, Buffer.from('mp3'))

    const renamedPath = await renameMp3File(
      sourcePath,
      { artist: 'Artist', title: 'Title' },
      '{artist} - {title}',
    )

    expect(renamedPath).toBe(sourcePath)
  })

  it('adds a numeric suffix when the target filename already exists', async () => {
    const sourcePath = join(tempDir, 'original.mp3')
    const existingPath = join(tempDir, 'Artist - Title.mp3')
    await writeFile(sourcePath, Buffer.from('new'))
    await writeFile(existingPath, Buffer.from('existing'))

    const renamedPath = await renameMp3File(
      sourcePath,
      { artist: 'Artist', title: 'Title' },
      '{artist} - {title}',
    )

    expect(renamedPath).toBe(join(tempDir, 'Artist - Title (1).mp3'))
    await expect(readFile(renamedPath)).resolves.toEqual(Buffer.from('new'))
    await expect(readFile(existingPath)).resolves.toEqual(Buffer.from('existing'))
  })

  it('truncates long auto-rename targets instead of exceeding path limits', async () => {
    const sourcePath = join(tempDir, '1-01 Sthuthi Sri Lanka.mp3')
    await writeFile(sourcePath, Buffer.from('mp3'))
    const manyArtists = Array.from({ length: 20 }, (_, i) => `Artist ${i}`).join(', ')

    const renamedPath = await renameMp3File(
      sourcePath,
      { artist: manyArtists, title: 'Sthuthi Sri Lanka' },
      '{artist} - {title}',
    )

    expect(renamedPath).not.toBe(sourcePath)
    expect(renamedPath.length).toBeLessThan(260)
    await expect(readFile(renamedPath)).resolves.toBeDefined()
  })
})
