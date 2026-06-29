import fs from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'
import { DEFAULT_RENAME_TEMPLATE } from '../shared/rename-template.js'

function settingsPath() {
  return path.join(app.getPath('userData'), 'app-settings.json')
}

/** Load user preferences (rename, etc.) — defaults: auto-rename off. */
export async function getAppSettings() {
  try {
    const raw = await fs.readFile(settingsPath(), 'utf-8')
    const saved = JSON.parse(raw)
    return {
      autoRenameEnabled: Boolean(saved.autoRenameEnabled),
      renameTemplate: saved.renameTemplate?.trim() || DEFAULT_RENAME_TEMPLATE,
      theme: saved.theme === 'light' ? 'light' : 'dark',
    }
  } catch {
    return {
      autoRenameEnabled: false,
      renameTemplate: DEFAULT_RENAME_TEMPLATE,
      theme: 'dark',
    }
  }
}

export async function saveAppSettings(settings) {
  await fs.writeFile(
    settingsPath(),
    JSON.stringify(
      {
        autoRenameEnabled: Boolean(settings.autoRenameEnabled),
        renameTemplate: settings.renameTemplate?.trim() || DEFAULT_RENAME_TEMPLATE,
        theme: settings.theme === 'light' ? 'light' : 'dark',
      },
      null,
      2,
    ),
    'utf-8',
  )
}
