import fs from 'node:fs/promises'
import path from 'node:path'
import { isSupportedAudio } from '../shared/audio-formats.js'

/** Recursively collect supported audio files under a folder (case-insensitive), sorted by name. */
export async function findAudioFiles(dirPath) {
  const results = []

  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
      } else if (entry.isFile() && isSupportedAudio(entry.name)) {
        results.push(fullPath)
      }
    }
  }

  await walk(dirPath)
  return results.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

/** @deprecated Use findAudioFiles — kept for existing callers and tests. */
export const findMp3Files = findAudioFiles
