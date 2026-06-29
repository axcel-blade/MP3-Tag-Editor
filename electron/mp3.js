import NodeID3 from 'node-id3'

/** ID3 text fields exposed in the UI and write path. */
const TAG_FIELDS = ['title', 'artist', 'album', 'year', 'genre', 'trackNumber', 'albumArtist']

/** Encode binary cover art for the renderer (data URLs). */
function toBase64(data) {
  if (!data) return ''
  return Buffer.from(data).toString('base64')
}

function normalizeMime(format) {
  if (!format) return 'image/jpeg'
  if (format.startsWith('image/')) return format
  if (format === 'jpg' || format === 'jpeg') return 'image/jpeg'
  if (format === 'png') return 'image/png'
  return `image/${format}`
}

function pictureFromNodeId3(id3) {
  const image = id3?.image
  if (!image?.imageBuffer) return null
  return {
    mime: normalizeMime(image.mime),
    data: toBase64(image.imageBuffer),
  }
}

/** Normalize node-id3 tag object for the UI. */
function normalizeTags(filePath, id3Tags = {}) {
  return {
    title: id3Tags.title ?? '',
    artist: id3Tags.artist ?? '',
    album: id3Tags.album ?? '',
    year: id3Tags.year ?? '',
    genre: id3Tags.genre ?? '',
    trackNumber: id3Tags.trackNumber ?? '',
    albumArtist: id3Tags.performerInfo ?? '',
    lyrics: id3Tags.unsynchronisedLyrics?.text?.trim() ?? '',
    picture: pictureFromNodeId3(id3Tags),
    filePath,
    fileName: filePath.split(/[/\\]/).pop() ?? '',
  }
}

/** Read all supported tags (including embedded cover and USLT lyrics) from an MP3 file. */
export async function readMp3Tags(filePath) {
  const id3Tags = NodeID3.read(filePath) ?? {}
  return normalizeTags(filePath, id3Tags)
}

function assertWriteResult(result) {
  if (result === true) return
  if (result instanceof Error) throw result
  throw new Error('Failed to write ID3 tags to file')
}

/**
 * Write selected ID3 fields back to disk.
 * Uses NodeID3.update so unselected tags are preserved.
 * When includeArtwork is true, downloads and replaces the front-cover APIC frame.
 */
export async function writeMp3Tags(filePath, fields, includeArtwork, artworkUrl) {
  const tags = {}

  if (fields.title !== undefined) tags.title = fields.title
  if (fields.artist !== undefined) tags.artist = fields.artist
  if (fields.album !== undefined) tags.album = fields.album
  if (fields.year !== undefined) tags.year = fields.year
  if (fields.genre !== undefined) tags.genre = fields.genre
  if (fields.trackNumber !== undefined) tags.trackNumber = fields.trackNumber
  if (fields.albumArtist !== undefined) tags.performerInfo = fields.albumArtist

  if (fields.lyrics !== undefined) {
    tags.unsynchronisedLyrics = {
      language: 'eng',
      text: fields.lyrics,
    }
  }

  if (includeArtwork && artworkUrl) {
    const response = await fetch(artworkUrl)
    if (!response.ok) {
      throw new Error(`Failed to download artwork (${response.status})`)
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    const mime = response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
    tags.image = {
      mime,
      type: { id: 3, name: 'front cover' },
      description: 'Album cover',
      imageBuffer: buffer,
    }
  }

  if (Object.keys(tags).length === 0) {
    throw new Error('No tags selected to write')
  }

  assertWriteResult(NodeID3.update(tags, filePath))
  return readMp3Tags(filePath)
}

export { TAG_FIELDS }
