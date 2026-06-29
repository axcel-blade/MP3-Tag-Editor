import { mkdtemp, readFile, rm, writeFile, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  backupMp3File,
  restoreMp3Backup,
  clearBackup,
  getLastBackupPath,
  transferBackup,
} from '../electron/backup.js'

describe('backupMp3File', () => {
  let tempDir
  let backupDir
  let sourcePath

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mp3-backup-src-'))
    backupDir = await mkdtemp(join(tmpdir(), 'mp3-backup-store-'))
    process.env.MP3_BACKUP_DIR = backupDir
    sourcePath = join(tempDir, 'song.mp3')
    await writeFile(sourcePath, Buffer.from('fake-mp3-content'))
  })

  afterEach(async () => {
    delete process.env.MP3_BACKUP_DIR
    clearBackup(sourcePath)
    await rm(tempDir, { recursive: true, force: true })
    await rm(backupDir, { recursive: true, force: true })
  })

  it('creates a backup copy before write', async () => {
    const backupPath = await backupMp3File(sourcePath)
    expect(backupPath).toContain('.mp3.bak')
    expect(getLastBackupPath(sourcePath)).toBe(backupPath)

    const original = await readFile(sourcePath, 'utf8')
    const backup = await readFile(backupPath, 'utf8')
    expect(backup).toBe(original)
  })

  it('restores file content from backup (undo)', async () => {
    await backupMp3File(sourcePath)
    await writeFile(sourcePath, Buffer.from('modified-content'))

    const restoredPath = await restoreMp3Backup(sourcePath)
    expect(restoredPath).toBe(sourcePath)
    const restored = await readFile(sourcePath, 'utf8')
    expect(restored).toBe('fake-mp3-content')
  })

  it('transfers backup tracking when file path changes', async () => {
    await backupMp3File(sourcePath)
    const newPath = join(tempDir, 'renamed.mp3')
    await rename(sourcePath, newPath)
    transferBackup(sourcePath, newPath)

    await writeFile(newPath, Buffer.from('modified'))
    const restoredPath = await restoreMp3Backup(newPath)
    expect(restoredPath).toBe(sourcePath)
    const content = await readFile(sourcePath, 'utf8')
    expect(content).toBe('fake-mp3-content')
  })

  it('throws when no backup exists', async () => {
    await expect(restoreMp3Backup(sourcePath)).rejects.toThrow(/No backup available/)
  })

  it('throws when the source file does not exist', async () => {
    await expect(backupMp3File(join(tempDir, 'missing.mp3'))).rejects.toThrow(/file not found/)
  })
})
