import { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { APP_DISPLAY_NAME, APP_VERSION } from './constants.js'
import { initLogger, logger, getLogDirectory, getCurrentLogPath } from './logger.js'
import { readMp3Tags, writeMp3Tags } from './mp3.js'
import { backupMp3File, restoreMp3Backup, clearBackup, transferBackup, configureBackupsRoot } from './backup.js'
import { getAppSettings, saveAppSettings } from './app-settings.js'
import { renameMp3File } from './rename.js'
import { findMp3Files } from './files.js'
import { searchAllMetadata } from './metadata/search.js'
import { getApiConfig, saveApiConfig } from './metadata/config.js'

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
    title: 'Select MP3 file',
    filters: [{ name: 'MP3 Files', extensions: ['mp3'] }],
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return { type: 'file', paths: [result.filePaths[0]] }
})

ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select folder with MP3 files',
    properties: ['openDirectory'],
  })
  if (result.canceled || result.filePaths.length === 0) return null

  const folderPath = result.filePaths[0]
  const paths = await findMp3Files(folderPath)
  return { type: 'folder', folderPath, paths }
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
    const tags = await readMp3Tags(filePath)
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
    let tags = await writeMp3Tags(resolvedFilePath, fields, includeArtwork, artworkUrl)
    let finalPath = resolvedFilePath

    const settings = await getAppSettings()
    if (settings.autoRenameEnabled) {
      const renamedPath = await renameMp3File(resolvedFilePath, tags, settings.renameTemplate)
      if (renamedPath !== resolvedFilePath) {
        transferBackup(resolvedFilePath, renamedPath)
        finalPath = renamedPath
        tags = await readMp3Tags(finalPath)
        logger.info('File renamed after tag write', { from: path.basename(resolvedFilePath), to: path.basename(finalPath) })
      }
    }

    logger.info('Wrote MP3 tags', {
      file: path.basename(finalPath),
      fields: Object.keys(fields),
      artwork: includeArtwork,
      renamed: finalPath !== resolvedFilePath,
    })
    return { tags, backupPath, filePath: finalPath, renamed: finalPath !== resolvedFilePath }
  } catch (err) {
    logger.error('mp3:writeTags failed', { file: resolvedFilePath, error: err.message })
    throw err
  }
})

ipcMain.handle('mp3:undoWrite', async (_event, filePath) => {
  const resolvedFilePath = path.resolve(filePath)
  try {
    const restoredPath = await restoreMp3Backup(resolvedFilePath)
    clearBackup(restoredPath)
    logger.info('Undid tag write', { file: path.basename(restoredPath) })
    const tags = await readMp3Tags(restoredPath)
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
