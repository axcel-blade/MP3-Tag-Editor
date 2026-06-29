import { createRequire } from 'node:module'
import { app } from 'electron'
import { logger } from './logger.js'
import {
  GITHUB_OWNER,
  GITHUB_REPO,
  GITHUB_RELEASES_URL,
  GITHUB_UPDATE_FEED_URL,
} from './constants.js'

const require = createRequire(import.meta.url)

const RELEASE_PAGE = GITHUB_RELEASES_URL

let getMainWindow = () => null
let autoUpdater = null

function resolveAutoUpdater() {
  if (!autoUpdater) {
    autoUpdater = require('electron-updater').autoUpdater
  }
  return autoUpdater
}

/** Override baked-in app-update.yml (fixes wrong repo slug in older installers). */
function configureUpdaterFeed(updater) {
  updater.setFeedURL({
    provider: 'generic',
    url: GITHUB_UPDATE_FEED_URL,
  })
  logger.info('Configured update feed', {
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    url: GITHUB_UPDATE_FEED_URL,
  })
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

function handleUpdateError(err) {
  const message = err?.message ?? String(err)
  logger.error('Application update failed', { error: message })
  sendUpdateStatus({ status: 'error', message, releasePage: RELEASE_PAGE })
  return message
}

/** Wire auto-updater events and optional startup check (packaged app only). */
export function initAutoUpdater(resolveMainWindow) {
  if (!app.isPackaged) return

  getMainWindow = resolveMainWindow
  const updater = resolveAutoUpdater()
  configureUpdaterFeed(updater)
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
    handleUpdateError(err)
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

  const updater = resolveAutoUpdater()
  configureUpdaterFeed(updater)

  try {
    await updater.checkForUpdates()
    return { started: true }
  } catch (err) {
    const message = handleUpdateError(err)
    return { error: message }
  }
}

/** Download the available update in the background. */
export async function downloadUpdate() {
  if (!app.isPackaged) {
    throw new Error('Updates are only available in the installed app')
  }
  configureUpdaterFeed(resolveAutoUpdater())
  try {
    await resolveAutoUpdater().downloadUpdate()
    return { started: true }
  } catch (err) {
    const message = handleUpdateError(err)
    return { error: message }
  }
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
