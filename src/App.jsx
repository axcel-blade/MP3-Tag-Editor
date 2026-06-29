import { useState, useCallback, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import './App.css'

/** Supported ID3 text fields shown in Current Tags and the Apply Tags modal. */
const TAG_FIELDS = [
  { key: 'title', label: 'Title' },
  { key: 'artist', label: 'Artist' },
  { key: 'album', label: 'Album' },
  { key: 'year', label: 'Year' },
  { key: 'genre', label: 'Genre' },
  { key: 'trackNumber', label: 'Track #' },
  { key: 'albumArtist', label: 'Album Artist' },
]

const SEARCH_PROVIDERS = [
  { key: 'musicbrainz', name: 'MusicBrainz', requiresKey: false },
  { key: 'itunes', name: 'iTunes', requiresKey: false },
  { key: 'deezer', name: 'Deezer', requiresKey: false },
  { key: 'musixmatch', name: 'Musixmatch', requiresKey: true },
  { key: 'lastfm', name: 'Last.fm', requiresKey: true },
  { key: 'spotify', name: 'Spotify', requiresKey: true },
]

const DEFAULT_SEARCH_PROVIDERS = ['musicbrainz', 'itunes', 'deezer']

const RESULT_FILTERS = ['All', ...SEARCH_PROVIDERS.map((p) => p.name)]

const SOURCE_CLASS = {
  Musixmatch: 'source-musixmatch',
  MusicBrainz: 'source-musicbrainz',
  iTunes: 'source-itunes',
  Deezer: 'source-deezer',
  'Last.fm': 'source-lastfm',
  Spotify: 'source-spotify',
}

function formatDuration(ms) {
  if (!ms) return ''
  const min = Math.floor(ms / 60000)
  const sec = Math.floor((ms % 60000) / 1000)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

function basename(filePath) {
  return filePath.split(/[/\\]/).pop() ?? filePath
}

function previewLyrics(text, maxLines = 3) {
  if (!text) return '—'
  const lines = text.split('\n').filter(Boolean)
  const preview = lines.slice(0, maxLines).join('\n')
  if (lines.length > maxLines) return `${preview}\n…`
  return preview
}

function lyricsSummary(text) {
  if (!text) return '—'
  const lines = text.split('\n').filter(Boolean).length
  return `${lines} line${lines === 1 ? '' : 's'}`
}

function providerLabel(key) {
  return SEARCH_PROVIDERS.find((p) => p.key === key)?.name ?? key
}

function isProviderConfigured(providerKey, config) {
  switch (providerKey) {
    case 'musixmatch':
      return Boolean(config.musixmatchApiKey)
    case 'lastfm':
      return Boolean(config.lastfmApiKey)
    case 'spotify':
      return Boolean(config.spotifyClientId && config.spotifyClientSecret)
    default:
      return true
  }
}

function App() {
  const [filePaths, setFilePaths] = useState([])
  const [folderPath, setFolderPath] = useState(null)
  const [filePath, setFilePath] = useState(null)
  const [currentTags, setCurrentTags] = useState(null)
  const [metadataResults, setMetadataResults] = useState([])
  const [providerErrors, setProviderErrors] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [customQuery, setCustomQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState('All')
  const [searchProviders, setSearchProviders] = useState(DEFAULT_SEARCH_PROVIDERS)
  const [selectedTrack, setSelectedTrack] = useState(null)
  const [selectedFields, setSelectedFields] = useState({})
  const [includeArtwork, setIncludeArtwork] = useState(true)
  const [includeLyrics, setIncludeLyrics] = useState(false)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [apiConfig, setApiConfig] = useState({
    musixmatchApiKey: '',
    lastfmApiKey: '',
    spotifyClientId: '',
    spotifyClientSecret: '',
    hasEnvFile: false,
  })

  useEffect(() => {
    window.electronAPI?.getApiConfig().then(setApiConfig)
  }, [])

  const filteredResults = useMemo(() => {
    if (sourceFilter === 'All') return metadataResults
    return metadataResults.filter((r) => r.source === sourceFilter)
  }, [metadataResults, sourceFilter])

  const resetSelection = useCallback(() => {
    setSelectedTrack(null)
    setSelectedFields({})
  }, [])

  useEffect(() => {
    if (!selectedTrack) return undefined

    const onKeyDown = (e) => {
      if (e.key === 'Escape') resetSelection()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [selectedTrack, resetSelection])

  const applySearchResponse = useCallback((response, fileName) => {
    setSearchQuery(response.query)
    setMetadataResults(response.results)
    setProviderErrors(response.errors ?? [])

    const count = response.results.length
    const searched = (response.searchedProviders ?? searchProviders).map(providerLabel).join(', ')
    if (count === 0) {
      const errSummary = response.errors?.map((e) => providerLabel(e.provider)).join(', ')
      setStatus(
        fileName
          ? `Loaded: ${fileName} — no matches from ${searched}${errSummary ? ` (${errSummary} failed)` : ''}`
          : `No results from ${searched}`,
      )
    } else {
      const sources = [...new Set(response.results.map((r) => r.source))].join(', ')
      setStatus(`Found ${count} result${count === 1 ? '' : 's'} from ${sources}`)
    }
  }, [searchProviders])

  const toggleSearchProvider = (key) => {
    const provider = SEARCH_PROVIDERS.find((p) => p.key === key)
    if (provider?.requiresKey && !isProviderConfigured(key, apiConfig)) return

    setSearchProviders((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )
  }

  const loadFile = useCallback(async (path) => {
    setError('')
    resetSelection()
    setMetadataResults([])
    setProviderErrors([])
    setFilePath(path)

    if (searchProviders.length === 0) {
      setError('Select at least one source to search.')
      return
    }

    setLoading(true)
    try {
      const tags = await window.electronAPI.readMp3Tags(path)
      setCurrentTags(tags)
      setCustomQuery([tags.title, tags.artist].filter(Boolean).join(' '))
      setStatus(`Loaded: ${tags.fileName} — searching ${searchProviders.map(providerLabel).join(', ')}...`)

      const response = await window.electronAPI.searchMetadata(tags, searchProviders)
      applySearchResponse(response, tags.fileName)
    } catch (err) {
      setError(err.message)
      setCurrentTags(null)
    } finally {
      setLoading(false)
    }
  }, [searchProviders, resetSelection, applySearchResponse])

  const handleOpenResult = async (result) => {
    if (!result || result.paths.length === 0) return

    setError('')
    setStatus('')
    resetSelection()
    setMetadataResults([])
    setFilePaths(result.paths)
    setFolderPath(result.type === 'folder' ? result.folderPath : null)

    if (result.type === 'folder') {
      setStatus(`Found ${result.paths.length} MP3 file${result.paths.length === 1 ? '' : 's'}`)
    }

    await loadFile(result.paths[0])
  }

  const handleOpenFile = async () => {
    const result = await window.electronAPI.openMp3File()
    await handleOpenResult(result)
  }

  const handleOpenFolder = async () => {
    const result = await window.electronAPI.openMp3Folder()
    if (!result) return
    if (result.paths.length === 0) {
      setError('No MP3 files found in the selected folder.')
      setFilePaths([])
      setFolderPath(result.folderPath)
      setFilePath(null)
      setCurrentTags(null)
      return
    }
    await handleOpenResult(result)
  }

  const handleSelectFile = async (path) => {
    if (path === filePath || loading) return
    await loadFile(path)
  }

  const handleCustomSearch = async (e) => {
    e.preventDefault()
    if (!customQuery.trim()) return
    if (searchProviders.length === 0) {
      setError('Select at least one source to search.')
      return
    }

    setLoading(true)
    setError('')
    resetSelection()
    try {
      const response = await window.electronAPI.searchMetadataCustom(customQuery.trim(), searchProviders)
      applySearchResponse(response)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectTrack = (track) => {
    setSelectedTrack(track)
    const defaults = {}
    TAG_FIELDS.forEach(({ key }) => {
      defaults[key] = Boolean(track[key])
    })
    setSelectedFields(defaults)
    setIncludeArtwork(Boolean(track.artworkUrl))
    setIncludeLyrics(Boolean(track.lyrics))
  }

  const toggleField = (key) => {
    setSelectedFields((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  /** Write checked fields (and optional artwork/lyrics) to the open MP3 file. */
  const handleApplyTags = async () => {
    if (!filePath || !selectedTrack) return

    const fieldsToWrite = {}
    TAG_FIELDS.forEach(({ key }) => {
      if (selectedFields[key] && selectedTrack[key] != null && selectedTrack[key] !== '') {
        fieldsToWrite[key] = selectedTrack[key]
      }
    })

    if (includeLyrics && selectedTrack.lyrics) {
      fieldsToWrite.lyrics = selectedTrack.lyrics
    }

    if (Object.keys(fieldsToWrite).length === 0 && !includeArtwork) {
      setError('Select at least one tag field, lyrics, or album artwork to apply.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const updated = await window.electronAPI.writeMp3Tags(
        filePath,
        fieldsToWrite,
        includeArtwork && selectedTrack.artworkUrl,
        selectedTrack.artworkUrl,
      )
      setCurrentTags(updated)
      setStatus(`Tags saved: ${updated.fileName}`)
      resetSelection()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSettings = async (e) => {
    e.preventDefault()
    await window.electronAPI.saveApiConfig(apiConfig)
    setShowSettings(false)
    setStatus('API settings saved.')
  }

  const showFileList = filePaths.length > 1

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1>MP3 Tag Editor</h1>
          <p className="subtitle">Musixmatch · MusicBrainz · Last.fm · iTunes · Spotify · Deezer</p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setShowSettings(true)}>
            Settings
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleOpenFolder} disabled={loading}>
            Open Folder
          </button>
          <button type="button" className="btn btn-primary" onClick={handleOpenFile} disabled={loading}>
            Open File
          </button>
        </div>
      </header>

      {(status || error) && (
        <div className={`banner ${error ? 'banner-error' : 'banner-info'}`}>
          {error || status}
        </div>
      )}

      {providerErrors.length > 0 && !error && (
        <div className="banner banner-warn">
          {providerErrors.map((e) => `${providerLabel(e.provider)}: ${e.message}`).join(' · ')}
        </div>
      )}

      <div className={`workspace ${showFileList ? 'with-sidebar' : ''}`}>
        {showFileList && (
          <aside className="panel file-list-panel">
            <div className="panel-header">
              <h2>Files</h2>
              <span className="file-count">{filePaths.length}</span>
            </div>
            {folderPath && (
              <p className="folder-path" title={folderPath}>
                {basename(folderPath)}
              </p>
            )}
            <ul className="file-list">
              {filePaths.map((path) => (
                <li key={path}>
                  <button
                    type="button"
                    className={`file-item ${path === filePath ? 'active' : ''}`}
                    onClick={() => handleSelectFile(path)}
                    disabled={loading}
                    title={path}
                  >
                    {basename(path)}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        )}

        <main className="main">
          <section className="panel current-tags">
            <h2>Current Tags</h2>
            {!currentTags ? (
              <p className="placeholder">Open an MP3 file or folder to view metadata</p>
            ) : (
              <div className="tags-grid">
                {currentTags.picture?.data ? (
                  <div className="cover-wrap">
                    <img
                      src={`data:${currentTags.picture.mime};base64,${currentTags.picture.data}`}
                      alt="Current cover"
                      className="cover"
                    />
                  </div>
                ) : (
                  <div className="cover-wrap">
                    <div className="cover cover-placeholder">No cover</div>
                  </div>
                )}
                <dl className="tag-list">
                  {TAG_FIELDS.map(({ key, label }) => (
                    <div key={key} className="tag-row">
                      <dt>{label}</dt>
                      <dd>{currentTags[key] || '—'}</dd>
                    </div>
                  ))}
                  <div className="tag-row file-row">
                    <dt>File</dt>
                    <dd className="file-path">{currentTags.fileName}</dd>
                  </div>
                  <div className="tag-row lyrics-row">
                    <dt>Lyrics</dt>
                    <dd className="lyrics-preview">{previewLyrics(currentTags.lyrics)}</dd>
                  </div>
                </dl>
              </div>
            )}
          </section>

          <section className="panel metadata-results">
            <div className="panel-header">
              <h2>Metadata Results</h2>
              {searchQuery && <span className="query-badge">Query: {searchQuery}</span>}
            </div>

            <div className="search-sources">
              <span className="search-sources-label">Search from</span>
              <div className="search-source-chips">
                {SEARCH_PROVIDERS.map((provider) => {
                  const configured = isProviderConfigured(provider.key, apiConfig)
                  const selected = searchProviders.includes(provider.key)
                  const disabled = provider.requiresKey && !configured
                  return (
                    <button
                      key={provider.key}
                      type="button"
                      className={`search-source-chip ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                      onClick={() => toggleSearchProvider(provider.key)}
                      disabled={disabled}
                      title={
                        disabled
                          ? 'Add API key in Settings or .env'
                          : provider.requiresKey
                            ? 'Requires API key'
                            : 'No API key needed'
                      }
                    >
                      {provider.name}
                      {provider.requiresKey && !configured && ' 🔒'}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="source-filters">
              <span className="search-sources-label">Show</span>
              {RESULT_FILTERS.map((source) => (
                <button
                  key={source}
                  type="button"
                  className={`source-chip ${sourceFilter === source ? 'active' : ''}`}
                  onClick={() => setSourceFilter(source)}
                >
                  {source}
                </button>
              ))}
            </div>

            <form className="search-form" onSubmit={handleCustomSearch}>
              <input
                type="text"
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder="Custom metadata search..."
                disabled={loading || !currentTags}
              />
              <button
                type="submit"
                className="btn btn-secondary"
                disabled={loading || !customQuery.trim() || !currentTags || searchProviders.length === 0}
              >
                Search
              </button>
            </form>

            {loading && (
              <p className="loading">
                Searching {searchProviders.map(providerLabel).join(', ')}...
              </p>
            )}

            {!loading && filteredResults.length === 0 && currentTags && (
              <p className="placeholder">No results for this filter</p>
            )}

            <ul className="results-list">
              {filteredResults.map((track) => (
                <li
                  key={track.id}
                  className={`result-item ${selectedTrack?.id === track.id ? 'selected' : ''}`}
                >
                  <button type="button" className="result-btn" onClick={() => handleSelectTrack(track)}>
                    {track.artworkUrl ? (
                      <img src={track.artworkUrl} alt="" className="result-cover" />
                    ) : (
                      <div className="result-cover placeholder-cover" />
                    )}
                    <div className="result-info">
                      <div className="result-title-row">
                        <strong>{track.title}</strong>
                        <span className={`source-badge ${SOURCE_CLASS[track.source] ?? ''}`}>
                          {track.source}
                        </span>
                      </div>
                      <span>{track.artist}</span>
                      <span className="muted">
                        {track.album} · {track.year}
                        {track.genre ? ` · ${track.genre}` : ''}
                        {track.durationMs ? ` · ${formatDuration(track.durationMs)}` : ''}
                        {track.lyrics ? ' · Lyrics' : ''}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </main>
      </div>

      {selectedTrack &&
        createPortal(
          <div className="modal-overlay" onClick={resetSelection} role="presentation">
            <div
              className="apply-modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="apply-tags-title"
            >
              <div className="apply-modal-header">
                <h2 id="apply-tags-title">Apply Tags</h2>
                <button type="button" className="modal-close" onClick={resetSelection} aria-label="Close">
                  ×
                </button>
              </div>
              <p className="apply-subtitle">
                From <span className={`source-badge ${SOURCE_CLASS[selectedTrack.source] ?? ''}`}>{selectedTrack.source}</span>
                {' — '}
                <strong>{selectedTrack.title}</strong> by <strong>{selectedTrack.artist}</strong>
              </p>

              <div className="apply-grid">
                <div className="apply-preview">
                  {selectedTrack.artworkUrl ? (
                    <img src={selectedTrack.artworkUrl} alt="" className="apply-cover" />
                  ) : (
                    <div className="apply-cover cover-placeholder">No art</div>
                  )}
                </div>

                <div className="field-selectors">
                  {TAG_FIELDS.map(({ key, label }) => {
                    const current = currentTags?.[key] ?? ''
                    const incoming = selectedTrack[key] ?? ''
                    const changed = incoming && incoming !== current
                    return (
                      <label key={key} className={`field-row ${changed ? 'changed' : ''}`}>
                        <input
                          type="checkbox"
                          checked={Boolean(selectedFields[key])}
                          onChange={() => toggleField(key)}
                          disabled={!incoming}
                        />
                        <span className="field-label">{label}</span>
                        <span className="field-current" title="Current">{current || '—'}</span>
                        <span className="field-arrow">→</span>
                        <span className="field-new" title="New">{incoming || '—'}</span>
                      </label>
                    )
                  })}

                  <label className="field-row artwork-row">
                    <input
                      type="checkbox"
                      checked={includeArtwork}
                      onChange={(e) => setIncludeArtwork(e.target.checked)}
                      disabled={!selectedTrack.artworkUrl}
                    />
                    <span className="field-label">Album Artwork</span>
                    <span className="field-new muted">
                      {selectedTrack.artworkUrl ? 'Embed cover art' : 'No artwork available'}
                    </span>
                  </label>

                  <label className={`field-row lyrics-apply-row ${selectedTrack.lyrics && selectedTrack.lyrics !== (currentTags?.lyrics ?? '') ? 'changed' : ''}`}>
                    <input
                      type="checkbox"
                      checked={includeLyrics}
                      onChange={(e) => setIncludeLyrics(e.target.checked)}
                      disabled={!selectedTrack.lyrics}
                    />
                    <span className="field-label">Lyrics</span>
                    <span className="field-new muted">
                      {selectedTrack.lyrics ? lyricsSummary(selectedTrack.lyrics) : 'No lyrics available'}
                    </span>
                  </label>
                </div>
              </div>

              {selectedTrack.lyrics && (
                <div className="lyrics-compare">
                  <div className="lyrics-block">
                    <h3>Current</h3>
                    <pre>{currentTags?.lyrics ? previewLyrics(currentTags.lyrics, 8) : '—'}</pre>
                  </div>
                  <div className="lyrics-block">
                    <h3>From {selectedTrack.source}</h3>
                    <pre>{previewLyrics(selectedTrack.lyrics, 8)}</pre>
                  </div>
                </div>
              )}

              <div className="apply-actions">
                <button type="button" className="btn btn-secondary" onClick={resetSelection}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={handleApplyTags} disabled={loading}>
                  Apply Selected Tags
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {showSettings &&
        createPortal(
          <div className="modal-overlay" onClick={() => setShowSettings(false)} role="presentation">
            <div className="modal-settings" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h2>API Settings</h2>
            <p className="modal-desc">
              MusicBrainz, iTunes, and Deezer work without keys. Optional keys go in <code>.env</code> or below.
            </p>
            {apiConfig.hasEnvFile && (
              <p className="modal-note">Using credentials from .env (Settings values are ignored while .env is set).</p>
            )}

            <form onSubmit={handleSaveSettings}>
              <label>
                Musixmatch API Key
                <input
                  type="password"
                  value={apiConfig.musixmatchApiKey}
                  onChange={(e) => setApiConfig((c) => ({ ...c, musixmatchApiKey: e.target.value }))}
                  placeholder="MUSIXMATCH_API_KEY"
                  autoComplete="off"
                  disabled={apiConfig.hasEnvFile}
                />
              </label>
              <label>
                Last.fm API Key
                <input
                  type="password"
                  value={apiConfig.lastfmApiKey}
                  onChange={(e) => setApiConfig((c) => ({ ...c, lastfmApiKey: e.target.value }))}
                  placeholder="LASTFM_API_KEY"
                  autoComplete="off"
                  disabled={apiConfig.hasEnvFile}
                />
              </label>
              <label>
                Spotify Client ID
                <input
                  type="text"
                  value={apiConfig.spotifyClientId}
                  onChange={(e) => setApiConfig((c) => ({ ...c, spotifyClientId: e.target.value }))}
                  placeholder="SPOTIFY_CLIENT_ID"
                  autoComplete="off"
                  disabled={apiConfig.hasEnvFile}
                />
              </label>
              <label>
                Spotify Client Secret
                <input
                  type="password"
                  value={apiConfig.spotifyClientSecret}
                  onChange={(e) => setApiConfig((c) => ({ ...c, spotifyClientSecret: e.target.value }))}
                  placeholder="SPOTIFY_CLIENT_SECRET"
                  autoComplete="off"
                  disabled={apiConfig.hasEnvFile}
                />
              </label>
              <p className="modal-desc">
                Musixmatch: <a href="https://developer.musixmatch.com/" target="_blank" rel="noreferrer">developer.musixmatch.com</a>
                {' · '}
                Last.fm: <a href="https://www.last.fm/api/account/create" target="_blank" rel="noreferrer">last.fm/api</a>
                {' · '}
                Spotify: <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">developer.spotify.com</a> (Premium required)
              </p>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSettings(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={apiConfig.hasEnvFile}>
                  Save
                </button>
              </div>
            </form>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

export default App
