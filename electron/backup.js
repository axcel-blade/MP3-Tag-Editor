import fs from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'

/** In-memory map of current file path → { backupPath, pathBeforeRename }. */
const lastBackups = new Map()

function backupsRoot() {
  if (process.env.MP3_BACKUP_DIR) {
    return process.env.MP3_BACKUP_DIR
  }
  return path.join(app.getPath('userData'), 'backups')
}

/**
 * Copy an MP3 to userData/backups before tag writes so the user can undo.
 * @returns {Promise<string>} Absolute path to the backup file
 */
export async function backupMp3File(filePath) {
  await fs.mkdir(backupsRoot(), { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const base = path.basename(filePath, path.extname(filePath))
  const backupPath = path.join(backupsRoot(), `${base}-${stamp}.mp3.bak`)
  await fs.copyFile(filePath, backupPath)
  lastBackups.set(filePath, { backupPath, pathBeforeRename: filePath })
  return backupPath
}

/** Move undo tracking when a file is renamed after write. */
export function transferBackup(oldPath, newPath) {
  const entry = lastBackups.get(oldPath)
  if (!entry) return
  lastBackups.delete(oldPath)
  lastBackups.set(newPath, entry)
}

/** Restore backup content and original filename when the file was auto-renamed. */
export async function restoreMp3Backup(filePath) {
  const entry = lastBackups.get(filePath)
  if (!entry) {
    throw new Error('No backup available to undo for this file')
  }
  await fs.access(entry.backupPath)
  await fs.copyFile(entry.backupPath, filePath)

  if (entry.pathBeforeRename && path.normalize(entry.pathBeforeRename) !== path.normalize(filePath)) {
    try {
      await fs.rename(filePath, entry.pathBeforeRename)
      return entry.pathBeforeRename
    } catch {
      // Target name may exist; keep restored content at current path
    }
  }
  return filePath
}

/** Return the latest backup path for a file, if any. */
export function getLastBackupPath(filePath) {
  return lastBackups.get(filePath)?.backupPath ?? null
}

/** Clear undo state after the user dismisses undo or loads a different file. */
export function clearBackup(filePath) {
  lastBackups.delete(filePath)
}
