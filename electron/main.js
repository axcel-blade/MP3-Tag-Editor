import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { APP_VERSION } from './constants.js'
import { readMp3Tags, writeMp3Tags } from './mp3.js'
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
    title: `MP3 Tag Editor v${APP_VERSION}`,
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

app.whenReady().then(() => {
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
    return await searchAllMetadata(tags, providers)
  } catch (err) {
    console.error('metadata:search error:', err)
    throw err
  }
})

ipcMain.handle('metadata:searchCustom', async (_event, query, providers) => {
  try {
    return await searchAllMetadata(query, providers)
  } catch (err) {
    console.error('metadata:searchCustom error:', err)
    throw err
  }
})

// --- MP3 tag read/write ---

ipcMain.handle('mp3:readTags', async (_event, filePath) => {
  try {
    return await readMp3Tags(filePath)
  } catch (err) {
    console.error('mp3:readTags error:', err)
    throw err
  }
})

ipcMain.handle('mp3:writeTags', async (_event, filePath, fields, includeArtwork, artworkUrl) => {
  try {
    return await writeMp3Tags(filePath, fields, includeArtwork, artworkUrl)
  } catch (err) {
    console.error('mp3:writeTags error:', err)
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
