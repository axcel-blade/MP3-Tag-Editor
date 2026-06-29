import fs from 'node:fs/promises'
import path from 'node:path'

/** Recursively collect .mp3 paths under a folder (case-insensitive), sorted by name. */
export async function findMp3Files(dirPath) {
  const results = []

  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.mp3')) {
        results.push(fullPath)
      }
    }
  }

  await walk(dirPath)
  return results.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}
