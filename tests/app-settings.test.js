import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_RENAME_TEMPLATE } from '../shared/rename-template.js'

let userDataDir = ''

vi.mock('electron', () => ({
  app: {
    getPath: () => userDataDir,
  },
}))

import { getAppSettings, saveAppSettings } from '../electron/app-settings.js'

describe('app settings', () => {
  beforeEach(async () => {
    userDataDir = await mkdtemp(join(tmpdir(), 'mp3-settings-'))
  })

  afterEach(async () => {
    await rm(userDataDir, { recursive: true, force: true })
  })

  it('returns defaults when no settings file exists', async () => {
    await expect(getAppSettings()).resolves.toEqual({
      autoRenameEnabled: false,
      renameTemplate: DEFAULT_RENAME_TEMPLATE,
      theme: 'system',
      savedActions: [],
    })
  })

  it('loads saved settings and normalizes invalid theme values', async () => {
    await writeFile(
      join(userDataDir, 'app-settings.json'),
      JSON.stringify({
        autoRenameEnabled: true,
        renameTemplate: ' {title} ',
        theme: 'invalid',
      }),
    )

    await expect(getAppSettings()).resolves.toEqual({
      autoRenameEnabled: true,
      renameTemplate: '{title}',
      theme: 'system',
      savedActions: [],
    })
  })

  it('persists settings to userData', async () => {
    await saveAppSettings({
      autoRenameEnabled: true,
      renameTemplate: '{artist}',
      theme: 'dark',
    })

    const raw = await readFile(join(userDataDir, 'app-settings.json'), 'utf-8')
    expect(JSON.parse(raw)).toEqual({
      autoRenameEnabled: true,
      renameTemplate: '{artist}',
      theme: 'dark',
      savedActions: [],
    })
  })

  it('round-trips saved actions and drops invalid ones', async () => {
    const action = { name: 'Tidy', steps: [{ mode: 'copy', options: { target: 'albumArtist', format: '{artist}', clearSource: false } }] }
    await saveAppSettings({ theme: 'dark', savedActions: [action, { name: 'Bad', steps: [{ mode: 'rm -rf' }] }] })
    const settings = await getAppSettings()
    expect(settings.savedActions).toEqual([action])
  })
})
