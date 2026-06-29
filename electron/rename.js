import fs from 'node:fs/promises'
import path from 'node:path'
import {
  DEFAULT_RENAME_TEMPLATE,
  applyRenameTemplate,
  sanitizeFilename,
  buildRenameFilename as buildName,
} from '../shared/rename-template.js'

export { DEFAULT_RENAME_TEMPLATE }

export function buildRenameFilename(template, tags, originalFilePath) {
  const originalBase = path.basename(originalFilePath, path.extname(originalFilePath))
  return buildName(template, tags, originalBase)
}

export function previewRename(template, tags, originalFilePath = 'song.mp3') {
  const originalBase = path.basename(originalFilePath, path.extname(originalFilePath))
  return buildName(template, tags, originalBase)
}

export async function renameMp3File(filePath, tags, template) {
  const dir = path.dirname(filePath)
  const newName = buildRenameFilename(template, tags, filePath)
  const newPath = path.join(dir, newName)

  if (path.normalize(newPath) === path.normalize(filePath)) {
    return filePath
  }

  try {
    await fs.access(newPath)
    const uniqueName = await resolveUniqueName(dir, newName)
    return fs.rename(filePath, path.join(dir, uniqueName))
  } catch {
    return fs.rename(filePath, newPath)
  }
}

async function resolveUniqueName(dir, fileName) {
  const ext = path.extname(fileName)
  const base = path.basename(fileName, ext)
  let attempt = 1
  while (attempt < 1000) {
    const candidate = `${base} (${attempt})${ext}`
    try {
      await fs.access(path.join(dir, candidate))
      attempt += 1
    } catch {
      return candidate
    }
  }
  throw new Error('Could not find a unique filename for rename')
}

// Re-export for tests that import applyRenameTemplate directly
export { applyRenameTemplate, sanitizeFilename }
