import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

let resolveBackupsRoot = null

/** Register how to resolve the backup folder (Electron main sets this on app ready). */
export function configureBackupsRoot(resolver) {
  resolveBackupsRoot = resolver
}

function backupsRoot() {
  if (process.env.MP3_BACKUP_DIR) {
    return process.env.MP3_BACKUP_DIR
  }
  if (!resolveBackupsRoot) {
    throw new Error('Backup storage is not configured')
  }
  return resolveBackupsRoot()
}

/** In-memory map of current file path → { backupPath, pathBeforeRename }. */
const lastBackups = new Map()

/**
 * Copy an MP3 to userData/backups before tag writes so the user can undo.
 * @returns {Promise<string>} Absolute path to the backup file
 */
export async function backupMp3File(filePath) {
  const resolvedPath = path.resolve(filePath)

  try {
    await fs.access(resolvedPath)
  } catch {
    throw new Error(`Cannot create backup: file not found (${resolvedPath})`)
  }

  const root = backupsRoot()
  await fs.mkdir(root, { recursive: true })

  const backupPath = path.join(root, `${crypto.randomUUID()}.mp3.bak`)
  await fs.copyFile(resolvedPath, backupPath)
  lastBackups.set(resolvedPath, { backupPath, pathBeforeRename: resolvedPath })
  return backupPath
}

/** Move undo tracking when a file is renamed after write. */
export function transferBackup(oldPath, newPath) {
  const resolvedOld = path.resolve(oldPath)
  const resolvedNew = path.resolve(newPath)
  const entry = lastBackups.get(resolvedOld)
  if (!entry) return
  lastBackups.delete(resolvedOld)
  lastBackups.set(resolvedNew, entry)
}

/** Restore backup content and original filename when the file was auto-renamed. */
export async function restoreMp3Backup(filePath) {
  const resolvedPath = path.resolve(filePath)
  const entry = lastBackups.get(resolvedPath)
  if (!entry) {
    throw new Error('No backup available to undo for this file')
  }
  await fs.access(entry.backupPath)
  await fs.copyFile(entry.backupPath, resolvedPath)

  if (entry.pathBeforeRename && path.normalize(entry.pathBeforeRename) !== path.normalize(resolvedPath)) {
    try {
      await fs.rename(resolvedPath, entry.pathBeforeRename)
      return entry.pathBeforeRename
    } catch {
      // Target name may exist; keep restored content at current path
    }
  }
  return resolvedPath
}

/** Return the latest backup path for a file, if any. */
export function getLastBackupPath(filePath) {
  return lastBackups.get(path.resolve(filePath))?.backupPath ?? null
}

/** Clear undo state after the user dismisses undo or loads a different file. */
export function clearBackup(filePath) {
  lastBackups.delete(path.resolve(filePath))
}
