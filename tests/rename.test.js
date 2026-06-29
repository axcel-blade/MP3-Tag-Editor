import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renameMp3File } from '../electron/rename.js'
import {
  applyRenameTemplate,
  buildRenameFilename,
  sanitizeFilename,
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

describe('buildRenameFilename', () => {
  it('appends .mp3 extension', () => {
    expect(
      buildRenameFilename('{artist} - {title}', { artist: 'A', title: 'B' }, 'old'),
    ).toBe('A - B.mp3')
  })

  it('falls back to original base when template resolves empty', () => {
    expect(buildRenameFilename('{artist}', {}, 'fallback-name')).toBe('fallback-name.mp3')
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
})
