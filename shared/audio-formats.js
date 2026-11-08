/** Audio file extensions the app can open and tag (lowercase, without the dot). */
export const AUDIO_EXTENSIONS = ['mp3', 'flac', 'm4a', 'm4b', 'ogg', 'oga', 'opus', 'wav', 'aiff', 'aif']

/** Lowercase extension without the dot ('' when there is none). */
export function extensionOf(filePath) {
  const name = String(filePath).split(/[\\/]/).pop() ?? ''
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

/** Filename without folder or extension. */
export function stemOf(filePath) {
  const name = String(filePath).split(/[\\/]/).pop() ?? ''
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

export function isSupportedAudio(filePath) {
  return AUDIO_EXTENSIONS.includes(extensionOf(filePath))
}

export function isMp3(filePath) {
  return extensionOf(filePath) === 'mp3'
}
