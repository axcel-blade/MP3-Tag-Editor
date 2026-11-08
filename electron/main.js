import { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { APP_DISPLAY_NAME, APP_VERSION } from './constants.js'
import { initLogger, logger, getLogDirectory, getCurrentLogPath } from './logger.js'
import { readAudioTags, writeAudioTags, readAudioCover, writeAudioCover, removeAudioCover } from './audio.js'
import { AUDIO_EXTENSIONS, isSupportedAudio } from '../shared/audio-formats.js'
import { formatM3U, parseM3U } from '../shared/playlist.js'
import { loadCoverFromFile } from './cover.js'
import { extensionForMime } from '../shared/cover-image.js'
import { backupMp3File, restoreMp3Backup, clearBackup, transferBackup, configureBackupsRoot } from './backup.js'
import { getAppSettings, saveAppSettings } from './app-settings.js'
import { renameMp3File } from './rename.js'
import { findAudioFiles } from './files.js'
import { searchAllMetadata } from './metadata/search.js'
import { getApiConfig, saveApiConfig } from './metadata/config.js'
import {
  initAutoUpdater,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  getReleasePageUrl,
} from './updater.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')
dotenv.config({ path: path.join(process.env.APP_ROOT, '.env') })
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

let mainWindow = null

/** Create the primary application window with context-isolated preload bridge. */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: `${APP_DISPLAY_NAME} v${APP_VERSION}`,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.whenReady().then(async () => {
  configureBackupsRoot(() => path.join(app.getPath('userData'), 'backups'))
  await initLogger()
  logger.info('Application started', { platform: process.platform, version: APP_VERSION })

  nativeTheme.on('updated', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(
        'theme:systemChanged',
        nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
      )
    }
  })

  createWindow()
  initAutoUpdater(() => mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// --- File dialogs ---

ipcMain.handle('dialog:openMp3', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select audio file',
    filters: [{ name: 'Audio Files', extensions: AUDIO_EXTENSIONS }],
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return { type: 'file', paths: [result.filePaths[0]] }
})

ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select folder with audio files',
    properties: ['openDirectory'],
  })
  if (result.canceled || result.filePaths.length === 0) return null

  const folderPath = result.filePaths[0]
  const paths = await findAudioFiles(folderPath)
  return { type: 'folder', folderPath, paths }
})

// --- Playlists (M3U / M3U8) ---

ipcMain.handle('playlist:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open playlist',
    filters: [{ name: 'Playlists', extensions: ['m3u8', 'm3u'] }],
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) return null

  const playlistPath = result.filePaths[0]
  const baseDir = path.dirname(playlistPath)
  const locations = parseM3U(await fs.readFile(playlistPath, 'utf8'))

  const paths = []
  let skipped = 0
  for (const location of locations) {
    const resolved = path.resolve(baseDir, location)
    if (!isSupportedAudio(resolved) || paths.includes(resolved)) {
      skipped += 1
      continue
    }
    try {
      await fs.access(resolved)
      paths.push(resolved)
    } catch {
      skipped += 1
    }
  }
  logger.info('Opened playlist', { file: path.basename(playlistPath), entries: paths.length, skipped })
  return { type: 'playlist', playlistPath, paths, skipped }
})

/** Save files as an M3U8 playlist. Entries on the same drive are stored relative to the playlist. */
ipcMain.handle('playlist:save', async (_event, entries, defaultName) => {
  if (!Array.isArray(entries) || entries.length === 0) throw new Error('No files to add to the playlist')

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save playlist',
    defaultPath: path.join(app.getPath('music'), `${path.basename(String(defaultName || 'playlist'))}.m3u8`),
    filters: [{ name: 'M3U8 playlist', extensions: ['m3u8'] }],
  })
  if (result.canceled || !result.filePath) return null

  const baseDir = path.dirname(result.filePath)
  const items = entries.map(({ path: filePath, title }) => {
    const relative = path.relative(baseDir, String(filePath))
    return { location: path.isAbsolute(relative) ? String(filePath) : relative, title }
  })
  await fs.writeFile(result.filePath, formatM3U(items), 'utf8')
  logger.info('Saved playlist', { file: path.basename(result.filePath), entries: items.length })
  return { filePath: result.filePath }
})

// --- Tag report export ---

const EXPORT_FILTERS = {
  csv: { name: 'CSV', extensions: ['csv'] },
  html: { name: 'HTML', extensions: ['html'] },
  json: { name: 'JSON', extensions: ['json'] },
}

ipcMain.handle('export:save', async (_event, format, defaultName, content) => {
  const filter = EXPORT_FILTERS[format]
  if (!filter) throw new Error(`Unknown export format: ${format}`)
  if (typeof content !== 'string') throw new Error('Nothing to export')

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export tag report',
    defaultPath: path.join(app.getPath('documents'), path.basename(String(defaultName || 'tag-report'))),
    filters: [filter],
  })
  if (result.canceled || !result.filePath) return null

  await fs.writeFile(result.filePath, content, 'utf8')
  logger.info('Exported tag report', { format, file: path.basename(result.filePath) })
  return { filePath: result.filePath }
})

ipcMain.handle('export:reveal', (_event, filePath) => {
  if (typeof filePath === 'string' && filePath) shell.showItemInFolder(filePath)
})

// --- Metadata search (parallel provider queries) ---

ipcMain.handle('metadata:search', async (_event, tags, providers) => {
  try {
    const result = await searchAllMetadata(tags, providers)
    logger.info('Metadata search completed', { query: result.query, count: result.results.length })
    return result
  } catch (err) {
    logger.error('metadata:search failed', { error: err.message })
    throw err
  }
})

ipcMain.handle('metadata:searchCustom', async (_event, query, providers) => {
  try {
    const result = await searchAllMetadata(query, providers)
    logger.info('Custom metadata search completed', { query: result.query, count: result.results.length })
    return result
  } catch (err) {
    logger.error('metadata:searchCustom failed', { error: err.message })
    throw err
  }
})

// --- MP3 tag read/write ---

ipcMain.handle('mp3:readTags', async (_event, filePath) => {
  try {
    const tags = await readAudioTags(filePath)
    logger.info('Read MP3 tags', { file: path.basename(filePath) })
    return tags
  } catch (err) {
    logger.error('mp3:readTags failed', { file: filePath, error: err.message })
    throw err
  }
})

ipcMain.handle('mp3:writeTags', async (_event, filePath, fields, includeArtwork, artworkUrl) => {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('No MP3 file selected')
  }
  const resolvedFilePath = path.resolve(filePath)
  try {
    const backupPath = await backupMp3File(resolvedFilePath)
    let tags = await writeAudioTags(resolvedFilePath, fields, includeArtwork, artworkUrl)
    let finalPath = resolvedFilePath
    let renameWarning = null

    const settings = await getAppSettings()
    if (settings.autoRenameEnabled) {
      try {
        const renamedPath = await renameMp3File(resolvedFilePath, tags, settings.renameTemplate)
        if (renamedPath !== resolvedFilePath) {
          transferBackup(resolvedFilePath, renamedPath)
          finalPath = renamedPath
          tags = await readAudioTags(finalPath)
          logger.info('File renamed after tag write', { from: path.basename(resolvedFilePath), to: path.basename(finalPath) })
        }
      } catch (renameErr) {
        renameWarning = renameErr.message
        logger.warn('Auto-rename failed after tag write; tags were saved', {
          file: path.basename(resolvedFilePath),
          error: renameErr.message,
        })
      }
    }

    logger.info('Wrote MP3 tags', {
      file: path.basename(finalPath),
      fields: Object.keys(fields),
      artwork: includeArtwork,
      renamed: finalPath !== resolvedFilePath,
    })
    return { tags, backupPath, filePath: finalPath, renamed: finalPath !== resolvedFilePath, renameWarning }
  } catch (err) {
    logger.error('mp3:writeTags failed', { file: resolvedFilePath, error: err.message })
    throw err
  }
})

ipcMain.handle('mp3:rename', async (_event, filePath, template) => {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('No MP3 file selected')
  }
  const resolvedFilePath = path.resolve(filePath)
  try {
    const tags = await readAudioTags(resolvedFilePath)
    const renamedPath = await renameMp3File(resolvedFilePath, tags, template)
    if (renamedPath !== resolvedFilePath) {
      transferBackup(resolvedFilePath, renamedPath)
      logger.info('Renamed file from tags', { from: path.basename(resolvedFilePath), to: path.basename(renamedPath) })
    }
    return { filePath: renamedPath, renamed: renamedPath !== resolvedFilePath }
  } catch (err) {
    logger.error('mp3:rename failed', { file: resolvedFilePath, error: err.message })
    throw err
  }
})

// --- Cover art ---

/** Back up, then apply a cover change to each file. Keeps going past failures. */
async function updateCovers(filePaths, label, change) {
  if (!Array.isArray(filePaths) || filePaths.length === 0) throw new Error('No MP3 files selected')
  const written = []
  const failures = []
  for (const filePath of filePaths) {
    const resolved = path.resolve(String(filePath))
    try {
      await backupMp3File(resolved)
      const tags = await change(resolved)
      written.push({ filePath: resolved, tags })
    } catch (err) {
      failures.push({ filePath: resolved, error: err.message })
      logger.error(`${label} failed`, { file: path.basename(resolved), error: err.message })
    }
  }
  logger.info(label, { written: written.length, failed: failures.length })
  return { written, failures }
}

ipcMain.handle('cover:pickImage', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose cover image',
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png'] }],
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

ipcMain.handle('cover:setFromFile', async (_event, filePaths, imagePath, maxEdge) => {
  if (!imagePath || typeof imagePath !== 'string') throw new Error('No image selected')
  const cover = await loadCoverFromFile(imagePath, Number(maxEdge) || 0)
  const result = await updateCovers(filePaths, 'Set cover from file', (file) => writeAudioCover(file, cover))
  return { ...result, width: cover.width, height: cover.height }
})

ipcMain.handle('cover:remove', async (_event, filePaths) =>
  updateCovers(filePaths, 'Removed cover', (file) => removeAudioCover(file)),
)

ipcMain.handle('cover:export', async (_event, filePath) => {
  const resolved = path.resolve(String(filePath))
  const cover = await readAudioCover(resolved)
  if (!cover) throw new Error('This file has no embedded cover')

  const stem = path.basename(resolved, path.extname(resolved))
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export cover image',
    defaultPath: path.join(path.dirname(resolved), `${stem} - cover.${extensionForMime(cover.mime)}`),
    filters: [{ name: 'Image', extensions: [extensionForMime(cover.mime)] }],
  })
  if (result.canceled || !result.filePath) return null

  await fs.writeFile(result.filePath, cover.buffer)
  logger.info('Exported cover', { file: path.basename(result.filePath) })
  return { filePath: result.filePath }
})

ipcMain.handle('mp3:undoWrite', async (_event, filePath) => {
  const resolvedFilePath = path.resolve(filePath)
  try {
    const restoredPath = await restoreMp3Backup(resolvedFilePath)
    clearBackup(restoredPath)
    logger.info('Undid tag write', { file: path.basename(restoredPath) })
    const tags = await readAudioTags(restoredPath)
    return { ...tags, filePath: restoredPath }
  } catch (err) {
    logger.error('mp3:undoWrite failed', { file: resolvedFilePath, error: err.message })
    throw err
  }
})

// --- API key configuration (.env or Settings UI) ---

ipcMain.handle('metadata:getConfig', async () => {
  const config = await getApiConfig()
  return {
    lastfmApiKey: config.lastfmApiKey,
    musixmatchApiKey: config.musixmatchApiKey,
    spotifyClientId: config.spotifyClientId,
    spotifyClientSecret: config.spotifyClientSecret,
    hasEnvFile: config.hasEnvFile,
    source: config.source,
  }
})

ipcMain.handle('metadata:saveConfig', async (_event, config) => {
  await saveApiConfig(config)
  return true
})

// --- App preferences (rename template, etc.) ---

ipcMain.handle('settings:get', async () => getAppSettings())

ipcMain.handle('settings:save', async (_event, settings) => {
  await saveAppSettings(settings)
  logger.info('App settings saved')
  return true
})

ipcMain.handle('theme:getSystem', () => (nativeTheme.shouldUseDarkColors ? 'dark' : 'light'))

ipcMain.handle('logs:getInfo', async () => ({
  logDir: getLogDirectory(),
  currentLog: getCurrentLogPath(),
}))

ipcMain.handle('logs:openFolder', async () => {
  const dir = getLogDirectory()
  if (dir) await shell.openPath(dir)
  return dir
})

// --- Application updates (GitHub Releases via electron-updater) ---

ipcMain.handle('update:check', async () => checkForUpdates())

ipcMain.handle('update:download', async () => downloadUpdate())

ipcMain.handle('update:install', () => installUpdate())

ipcMain.handle('update:getReleasePage', () => getReleasePageUrl())

ipcMain.handle('update:getVersion', () => app.getVersion())
