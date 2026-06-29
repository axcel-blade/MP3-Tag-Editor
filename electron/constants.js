import pkg from '../package.json' with { type: 'json' }

/** Application semver — keep in sync with package.json version field. */
export const APP_VERSION = pkg.version

/** Human-readable application name shown in the UI and window title. */
export const APP_DISPLAY_NAME = 'MP3 Tag Editor'

/** Compact name used in MusicBrainz User-Agent strings. */
export const APP_NAME = 'MP3TagEditor'

/** Default MusicBrainz User-Agent when none is configured in .env. */
export const GITHUB_OWNER = 'axcel-blade'
export const GITHUB_REPO = 'mp3-tag-editor'
export const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`
/** Base URL where electron-updater fetches latest.yml from GitHub Releases. */
export const GITHUB_UPDATE_FEED_URL = `${GITHUB_RELEASES_URL}/download`

export const DEFAULT_USER_AGENT = `${APP_NAME}/${APP_VERSION} (https://github.com/${GITHUB_OWNER}/${GITHUB_REPO})`
