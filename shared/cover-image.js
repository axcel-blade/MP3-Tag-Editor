/** Max cover edge sizes offered in the UI (0 keeps the original size). */
export const COVER_SIZE_OPTIONS = [0, 500, 800, 1000, 1400]

/** Scale (width, height) down to fit within maxEdge, keeping aspect ratio. Never upscales. */
export function fitWithin(width, height, maxEdge) {
  const w = Math.max(0, Math.round(width))
  const h = Math.max(0, Math.round(height))
  if (!maxEdge || maxEdge <= 0 || (w <= maxEdge && h <= maxEdge) || w === 0 || h === 0) {
    return { width: w, height: h, resized: false }
  }
  const scale = maxEdge / Math.max(w, h)
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
    resized: true,
  }
}

/** File extension for an image MIME type. */
export function extensionForMime(mime) {
  switch (String(mime).toLowerCase()) {
    case 'image/png':
      return 'png'
    case 'image/gif':
      return 'gif'
    case 'image/webp':
      return 'webp'
    case 'image/bmp':
      return 'bmp'
    default:
      return 'jpg'
  }
}

/** MIME type from an image filename, or null when the extension is not a supported cover format. */
export function mimeForFilename(fileName) {
  const ext = String(fileName).toLowerCase().split('.').pop()
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  return null
}
