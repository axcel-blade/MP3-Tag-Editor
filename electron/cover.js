import fs from 'node:fs/promises'
import path from 'node:path'
import { nativeImage } from 'electron'
import { fitWithin, mimeForFilename } from '../shared/cover-image.js'

/** Largest image file accepted as a cover source. */
const MAX_COVER_FILE_BYTES = 20 * 1024 * 1024

/**
 * Load a JPEG/PNG from disk for embedding, optionally shrinking it so the longest
 * edge is at most maxEdge. Resized covers are re-encoded as JPEG (quality 90);
 * images that already fit are embedded byte-for-byte.
 */
export async function loadCoverFromFile(imagePath, maxEdge = 0) {
  const mime = mimeForFilename(imagePath)
  if (!mime) throw new Error('Choose a JPEG or PNG image')

  const stat = await fs.stat(imagePath)
  if (stat.size > MAX_COVER_FILE_BYTES) throw new Error('Image is larger than 20 MB')

  const buffer = await fs.readFile(imagePath)
  const image = nativeImage.createFromBuffer(buffer)
  if (image.isEmpty()) throw new Error(`Could not read image: ${path.basename(imagePath)}`)

  const { width, height } = image.getSize()
  const target = fitWithin(width, height, maxEdge)
  if (!target.resized) return { mime, buffer, width, height }

  const resized = image.resize({ width: target.width, height: target.height, quality: 'best' })
  return { mime: 'image/jpeg', buffer: resized.toJPEG(90), width: target.width, height: target.height }
}
