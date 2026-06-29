import pkg from '../package.json' with { type: 'json' }

/** Application semver — keep in sync with package.json version field. */
export const APP_VERSION = pkg.version

/** Short name used in MusicBrainz User-Agent strings. */
export const APP_NAME = 'MP3TagEditor'

/** Default MusicBrainz User-Agent when none is configured in .env. */
export const DEFAULT_USER_AGENT = `${APP_NAME}/${APP_VERSION} (https://github.com/axcel-blade/mp3-tag-editor)`
