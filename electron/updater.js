import { createRequire } from 'node:module'
import { app } from 'electron'
import { logger } from './logger.js'

const require = createRequire(import.meta.url)

const RELEASE_PAGE = 'https://github.com/axcel-blade/MP3-Tag-Editor/releases/latest'

let getMainWindow = () => null
let autoUpdater = null

function resolveAutoUpdater() {
  if (!autoUpdater) {
    autoUpdater = require('electron-updater').autoUpdater
  }
  return autoUpdater
}

function sendUpdateStatus(payload) {
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send('update:status', payload)
  }
}

function pickUpdateInfo(info) {
  if (!info) return {}
  return {
    version: info.version ?? null,
    releaseDate: info.releaseDate ?? null,
    releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
  }
}

/** Wire auto-updater events and optional startup check (packaged app only). */
export function initAutoUpdater(resolveMainWindow) {
  if (!app.isPackaged) return

  getMainWindow = resolveMainWindow
  const updater = resolveAutoUpdater()
  updater.autoDownload = false
  updater.autoInstallOnAppQuit = true

  updater.on('checking-for-update', () => {
    logger.info('Checking for application update')
    sendUpdateStatus({ status: 'checking' })
  })

  updater.on('update-available', (info) => {
    logger.info('Application update available', { version: info.version })
    sendUpdateStatus({ status: 'available', ...pickUpdateInfo(info) })
  })

  updater.on('update-not-available', (info) => {
    logger.info('Application is up to date', { version: info.version })
    sendUpdateStatus({ status: 'not-available', version: info.version ?? app.getVersion() })
  })

  updater.on('error', (err) => {
    logger.error('Application update failed', { error: err.message })
    sendUpdateStatus({ status: 'error', message: err.message, releasePage: RELEASE_PAGE })
  })

  updater.on('download-progress', (progress) => {
    sendUpdateStatus({
      status: 'downloading',
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
    })
  })

  updater.on('update-downloaded', (info) => {
    logger.info('Application update downloaded', { version: info.version })
    sendUpdateStatus({ status: 'downloaded', ...pickUpdateInfo(info) })
  })

  setTimeout(() => {
    checkForUpdates().catch((err) => {
      logger.error('Startup update check failed', { error: err.message })
    })
  }, 4000)
}

/** Check GitHub Releases for a newer version. */
export async function checkForUpdates() {
  if (!app.isPackaged) {
    return { skipped: true, reason: 'dev' }
  }
  await resolveAutoUpdater().checkForUpdates()
  return { started: true }
}

/** Download the available update in the background. */
export async function downloadUpdate() {
  if (!app.isPackaged) {
    throw new Error('Updates are only available in the installed app')
  }
  await resolveAutoUpdater().downloadUpdate()
  return true
}

/** Quit and install a downloaded update. */
export function installUpdate() {
  if (!app.isPackaged) return false
  resolveAutoUpdater().quitAndInstall()
  return true
}

export function getReleasePageUrl() {
  return RELEASE_PAGE
}
