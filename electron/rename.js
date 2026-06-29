import fs from 'node:fs/promises'
import path from 'node:path'
import {
  DEFAULT_RENAME_TEMPLATE,
  MAX_FILENAME_STEM_LENGTH,
  applyRenameTemplate,
  sanitizeFilename,
  buildRenameFilename as buildName,
} from '../shared/rename-template.js'

export { DEFAULT_RENAME_TEMPLATE }

const WINDOWS_MAX_PATH = 260
const PATH_RESERVE = 16

/** Shrink the filename stem so dir + name + ".mp3" stays within Windows path limits. */
export function maxStemLengthForDir(dir, cap = MAX_FILENAME_STEM_LENGTH) {
  const available = WINDOWS_MAX_PATH - String(dir).length - PATH_RESERVE
  return Math.max(32, Math.min(cap, available))
}

export function buildRenameFilename(template, tags, originalFilePath) {
  const originalBase = path.basename(originalFilePath, path.extname(originalFilePath))
  const dir = path.dirname(originalFilePath)
  return buildName(template, tags, originalBase, {
    maxStemLength: maxStemLengthForDir(dir),
  })
}

export function previewRename(template, tags, originalFilePath = 'song.mp3') {
  const originalBase = path.basename(originalFilePath, path.extname(originalFilePath))
  const dir = path.dirname(originalFilePath)
  return buildName(template, tags, originalBase, {
    maxStemLength: maxStemLengthForDir(dir),
  })
}

export async function renameMp3File(filePath, tags, template) {
  const resolvedPath = path.resolve(filePath)
  const dir = path.dirname(resolvedPath)
  const newName = buildRenameFilename(template, tags, resolvedPath)
  const newPath = path.join(dir, newName)

  if (path.normalize(newPath) === path.normalize(resolvedPath)) {
    return resolvedPath
  }

  try {
    await fs.access(resolvedPath)
  } catch {
    throw new Error(`Cannot rename: file not found (${resolvedPath})`)
  }

  let targetPath = newPath
  try {
    await fs.access(newPath)
    const uniqueName = await resolveUniqueName(dir, newName)
    targetPath = path.join(dir, uniqueName)
  } catch {
    // Target name is free.
  }

  await fs.rename(resolvedPath, targetPath)
  return targetPath
}

async function resolveUniqueName(dir, fileName) {
  const ext = path.extname(fileName)
  const base = path.basename(fileName, ext)
  let attempt = 1
  while (attempt < 1000) {
    const candidate = `${base} (${attempt})${ext}`
    const candidatePath = path.join(dir, candidate)
    if (candidatePath.length > WINDOWS_MAX_PATH - 4) {
      throw new Error('Cannot rename: target path would exceed Windows path length limit')
    }
    try {
      await fs.access(candidatePath)
      attempt += 1
    } catch {
      return candidate
    }
  }
  throw new Error('Could not find a unique filename for rename')
}

// Re-export for tests that import applyRenameTemplate directly
export { applyRenameTemplate, sanitizeFilename }
