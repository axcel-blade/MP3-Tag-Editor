import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let userDataDir = ''

vi.mock('electron', () => ({
  app: {
    getPath: () => userDataDir,
  },
}))

import {
  getApiConfig,
  saveApiConfig,
  getMusicBrainzUserAgent,
} from '../electron/metadata/config.js'

describe('metadata config', () => {
  const originalEnv = { ...process.env }

  beforeEach(async () => {
    userDataDir = await mkdtemp(join(tmpdir(), 'mp3-api-config-'))
    process.env = { ...originalEnv }
    delete process.env.LASTFM_API_KEY
    delete process.env.MUSIXMATCH_API_KEY
    delete process.env.SPOTIFY_CLIENT_ID
    delete process.env.SPOTIFY_CLIENT_SECRET
    delete process.env.MUSICBRAINZ_USER_AGENT
  })

  afterEach(async () => {
    process.env = originalEnv
    await rm(userDataDir, { recursive: true, force: true })
  })

  it('prefers environment variables over saved settings', async () => {
    process.env.LASTFM_API_KEY = 'env-lastfm'
    await writeFile(
      join(userDataDir, 'api-config.json'),
      JSON.stringify({ lastfmApiKey: 'saved-lastfm' }),
    )

    const config = await getApiConfig()
    expect(config.lastfmApiKey).toBe('env-lastfm')
    expect(config.hasEnvFile).toBe(true)
    expect(config.source).toBe('env')
  })

  it('loads saved API keys when env vars are absent', async () => {
    await saveApiConfig({
      lastfmApiKey: 'saved-lastfm',
      musixmatchApiKey: '',
      spotifyClientId: '',
      spotifyClientSecret: '',
    })

    const config = await getApiConfig()
    expect(config.lastfmApiKey).toBe('saved-lastfm')
    expect(config.hasEnvFile).toBe(false)
    expect(config.source).toBe('settings')
  })

  it('returns the configured MusicBrainz user agent', async () => {
    process.env.MUSICBRAINZ_USER_AGENT = 'CustomAgent/2.0'
    const config = await getApiConfig()
    expect(getMusicBrainzUserAgent(config)).toBe('CustomAgent/2.0')
  })
})
