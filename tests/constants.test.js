import { describe, expect, it } from 'vitest'
import pkg from '../package.json' with { type: 'json' }
import {
  APP_VERSION,
  APP_DISPLAY_NAME,
  APP_NAME,
  GITHUB_OWNER,
  GITHUB_REPO,
  GITHUB_RELEASES_URL,
  GITHUB_UPDATE_FEED_URL,
  DEFAULT_USER_AGENT,
} from '../electron/constants.js'

describe('constants', () => {
  it('keeps APP_VERSION in sync with package.json', () => {
    expect(APP_VERSION).toBe(pkg.version)
  })

  it('exposes application display metadata', () => {
    expect(APP_DISPLAY_NAME).toBe('MP3 Tag Editor')
    expect(APP_NAME).toBe('MP3TagEditor')
  })

  it('points GitHub release URLs at the real repository slug', () => {
    expect(GITHUB_OWNER).toBe('axcel-blade')
    expect(GITHUB_REPO).toBe('mp3-tag-editor')
    expect(GITHUB_RELEASES_URL).toBe(
      'https://github.com/axcel-blade/mp3-tag-editor/releases/latest',
    )
    expect(GITHUB_UPDATE_FEED_URL).toBe(
      'https://github.com/axcel-blade/mp3-tag-editor/releases/latest/download',
    )
  })

  it('builds the default MusicBrainz user agent from app metadata', () => {
    expect(DEFAULT_USER_AGENT).toContain(APP_NAME)
    expect(DEFAULT_USER_AGENT).toContain(APP_VERSION)
    expect(DEFAULT_USER_AGENT).toContain(GITHUB_REPO)
  })
})
