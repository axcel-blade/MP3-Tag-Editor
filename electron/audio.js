import fs from 'node:fs/promises'
import path from 'node:path'
import {
  readMp3Tags,
  writeMp3Tags,
  readCoverImage as readMp3Cover,
  writeCoverImage as writeMp3Cover,
  removeCoverImage as removeMp3Cover,
} from './mp3.js'
import { isMp3, isSupportedAudio } from '../shared/audio-formats.js'

/**
 * Format-agnostic tag I/O. MP3 keeps using node-id3 (mp3.js); every other
 * supported format (FLAC, M4A, Ogg, Opus, WAV, AIFF) goes through TagLib (taglib-wasm).
 * Both backends return the same normalized tag shape.
 */

let taglibPromise = null

/** Load taglib-wasm lazily so MP3-only sessions never pay the WebAssembly startup cost. */
function taglib() {
  taglibPromise ??= import('taglib-wasm/simple')
  return taglibPromise
}

function assertSupported(filePath) {
  if (!isSupportedAudio(filePath)) {
    throw new Error(`Unsupported file type: ${path.basename(filePath)}`)
  }
}

function joinValues(value) {
  if (Array.isArray(value)) return value.filter((v) => v != null && v !== '').join('; ')
  return value == null ? '' : String(value)
}

/** "3" or "3/12" from TagLib's separate number and total ('' when unset). */
function formatPosition(number, total) {
  if (!number) return ''
  return total ? `${number}/${total}` : String(number)
}

/**
 * Parse "3", "03" or "3/12" into numbers for TagLib. '' clears both.
 * Throws for anything else so bad input is reported instead of silently dropped.
 */
export function parsePosition(value, label) {
  const text = String(value ?? '').trim()
  if (text === '') return { number: 0, total: 0 }
  const match = /^(\d+)\s*(?:\/\s*(\d+))?$/.exec(text)
  if (!match) throw new Error(`${label} must be a number like 3 or 3/12`)
  return { number: Number(match[1]), total: match[2] ? Number(match[2]) : 0 }
}

/** TagLib input for a year/date value: plain years as numbers, full dates as text. */
function yearInput(value) {
  const text = String(value ?? '').trim()
  if (text === '') return { year: 0 }
  if (/^\d{4}$/.test(text)) return { year: Number(text) }
  return { date: text }
}

function pickCover(pictures) {
  if (!pictures?.length) return null
  return pictures.find((p) => p.type === 'FrontCover') ?? pictures[0]
}

async function readTaglibTags(filePath) {
  const { readTags, readPictures } = await taglib()
  const [tags, pictures] = await Promise.all([readTags(filePath), readPictures(filePath)])
  const cover = pickCover(pictures)
  // TagLib stores a cleared year as 0, which reads back as the date "0".
  const date = joinValues(tags.date)
  return {
    title: joinValues(tags.title),
    artist: joinValues(tags.artist),
    album: joinValues(tags.album),
    year: date && date !== '0' ? date : tags.year ? String(tags.year) : '',
    genre: joinValues(tags.genre),
    trackNumber: formatPosition(tags.track, tags.totalTracks),
    discNumber: formatPosition(tags.discNumber, tags.totalDiscs),
    albumArtist: joinValues(tags.albumArtist),
    lyrics: tags.lyrics?.[0]?.text?.trim() ?? '',
    picture: cover ? { mime: cover.mimeType || 'image/jpeg', data: Buffer.from(cover.data).toString('base64') } : null,
    filePath,
    fileName: path.basename(filePath),
  }
}

/** Map the app's field names onto a TagLib TagInput. Only fields present in `fields` are set. */
export function toTaglibInput(fields) {
  const input = {}
  for (const key of ['title', 'artist', 'album', 'genre', 'albumArtist']) {
    if (fields[key] !== undefined) input[key] = String(fields[key])
  }
  if (fields.year !== undefined) Object.assign(input, yearInput(fields.year))
  if (fields.trackNumber !== undefined) {
    const { number, total } = parsePosition(fields.trackNumber, 'Track number')
    input.track = number
    input.totalTracks = total
  }
  if (fields.discNumber !== undefined) {
    const { number, total } = parsePosition(fields.discNumber, 'Disc number')
    input.discNumber = number
    input.totalDiscs = total
  }
  if (fields.lyrics !== undefined) {
    input.lyrics = fields.lyrics ? [{ text: String(fields.lyrics), language: 'eng', description: '' }] : []
  }
  return input
}

async function downloadArtwork(artworkUrl) {
  const response = await fetch(artworkUrl)
  if (!response.ok) throw new Error(`Failed to download artwork (${response.status})`)
  const mime = response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
  return { mime, buffer: Buffer.from(await response.arrayBuffer()) }
}

async function writeTaglibCover(filePath, { mime, buffer }) {
  const { applyCoverArt } = await taglib()
  await fs.writeFile(filePath, await applyCoverArt(filePath, new Uint8Array(buffer), mime))
}

// --- Public API (same signatures as the MP3 functions in mp3.js) ---

export async function readAudioTags(filePath) {
  assertSupported(filePath)
  return isMp3(filePath) ? readMp3Tags(filePath) : readTaglibTags(filePath)
}

export async function writeAudioTags(filePath, fields, includeArtwork, artworkUrl) {
  assertSupported(filePath)
  if (isMp3(filePath)) return writeMp3Tags(filePath, fields, includeArtwork, artworkUrl)

  const input = toTaglibInput(fields)
  const withArtwork = Boolean(includeArtwork && artworkUrl)
  if (Object.keys(input).length === 0 && !withArtwork) {
    throw new Error('No tags selected to write')
  }

  // Download first so a failed download leaves the file untouched.
  const artwork = withArtwork ? await downloadArtwork(artworkUrl) : null
  if (Object.keys(input).length > 0) {
    const { applyTagsToFile } = await taglib()
    await applyTagsToFile(filePath, input)
  }
  if (artwork) await writeTaglibCover(filePath, artwork)
  return readTaglibTags(filePath)
}

/** Embedded front cover as { mime, buffer }, or null. */
export async function readAudioCover(filePath) {
  assertSupported(filePath)
  if (isMp3(filePath)) return readMp3Cover(filePath)
  const { readPictures } = await taglib()
  const cover = pickCover(await readPictures(filePath))
  return cover ? { mime: cover.mimeType || 'image/jpeg', buffer: Buffer.from(cover.data) } : null
}

export async function writeAudioCover(filePath, cover) {
  assertSupported(filePath)
  if (isMp3(filePath)) return writeMp3Cover(filePath, cover)
  await writeTaglibCover(filePath, cover)
  return readTaglibTags(filePath)
}

export async function removeAudioCover(filePath) {
  assertSupported(filePath)
  if (isMp3(filePath)) return removeMp3Cover(filePath)
  const { clearPictures } = await taglib()
  await fs.writeFile(filePath, await clearPictures(filePath))
  return readTaglibTags(filePath)
}
