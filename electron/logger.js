import fs from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 }
let minLevel = LOG_LEVELS.info
let logDir = null
let currentLogPath = null

function timestamp() {
  return new Date().toISOString()
}

function logFileName(date = new Date()) {
  const day = date.toISOString().slice(0, 10)
  return `MP3 Tag Editor-${day}.log`
}

/** Resolve and create the per-user log directory. */
export async function initLogger() {
  logDir = path.join(app.getPath('userData'), 'logs')
  await fs.mkdir(logDir, { recursive: true })
  currentLogPath = path.join(logDir, logFileName())
  await writeLine('info', 'Logger initialized', { version: app.getVersion?.() ?? 'unknown' })
  return currentLogPath
}

export function getLogDirectory() {
  return logDir
}

export function getCurrentLogPath() {
  return currentLogPath
}

async function writeLine(level, message, meta) {
  if (LOG_LEVELS[level] > minLevel) return

  const metaText = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : ''
  const line = `[${timestamp()}] [${level.toUpperCase()}] ${message}${metaText}\n`

  if (process.env.NODE_ENV !== 'production') {
    const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
    consoleFn(`MP3 Tag Editor | ${line.trim()}`)
  }

  if (!logDir) return

  try {
    if (!currentLogPath || logFileName() !== path.basename(currentLogPath)) {
      currentLogPath = path.join(logDir, logFileName())
    }
    await fs.appendFile(currentLogPath, line, 'utf8')
  } catch (err) {
    console.error('Failed to write log file:', err.message)
  }
}

export const logger = {
  error: (message, meta) => writeLine('error', message, meta),
  warn: (message, meta) => writeLine('warn', message, meta),
  info: (message, meta) => writeLine('info', message, meta),
  debug: (message, meta) => writeLine('debug', message, meta),
}
