import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { buildRenameFilename, DEFAULT_RENAME_TEMPLATE, RENAME_PLACEHOLDERS } from '@shared/rename-template.js'
import { KEEP_PLACEHOLDER, buildBatchChanges, createBatchDraft, mergeTags } from '@shared/batch-tags.js'
import { THEME_OPTIONS, applyTheme, normalizeThemeMode } from './theme.js'
import './App.css'

const SAMPLE_TAGS_FOR_PREVIEW = {
  artist: 'Artist Name',
  title: 'Song Title',
  album: 'Album Name',
  year: '2024',
  genre: 'Pop',
  trackNumber: '03',
  albumArtist: 'Artist Name',
}

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
  /** Files written by the last save (one file, or every file in a batch). */
  const [undoPaths, setUndoPaths] = useState([])
  const canUndo = undoPaths.length > 0
  /** Files selected in the sidebar; more than one switches to batch editing. */
  const [selectedPaths, setSelectedPaths] = useState([])
  const [batchMerged, setBatchMerged] = useState(null)
  const [batchDraft, setBatchDraft] = useState(null)
  const [batchReloadToken, setBatchReloadToken] = useState(0)
  const [batchKey, setBatchKey] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [logInfo, setLogInfo] = useState(null)
  const [apiConfig, setApiConfig] = useState({
    musixmatchApiKey: '',
    lastfmApiKey: '',
    spotifyClientId: '',
    spotifyClientSecret: '',
    hasEnvFile: false,
  })
  const [isEditingTags, setIsEditingTags] = useState(false)
  const [manualDraft, setManualDraft] = useState(null)
  const [appSettings, setAppSettings] = useState({
    autoRenameEnabled: false,
    renameTemplate: DEFAULT_RENAME_TEMPLATE,
    theme: 'system',
  })
  const [systemTheme, setSystemTheme] = useState(null)
  const [updateInfo, setUpdateInfo] = useState({ status: 'idle' })
  const [updateChecking, setUpdateChecking] = useState(false)
  const [appVersion, setAppVersion] = useState('')
  const manualUpdateCheck = useRef(false)

  useEffect(() => {
    window.electronAPI?.getApiConfig().then(setApiConfig)
    window.electronAPI?.getAppSettings().then((settings) => {
      setAppSettings({
        ...settings,
        theme: normalizeThemeMode(settings.theme),
      })
    })
    window.electronAPI?.getSystemTheme?.().then(setSystemTheme)
    window.electronAPI?.getAppVersion?.().then((version) => {
      if (version) setAppVersion(version)
    })
  }, [])

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onUpdateStatus?.((payload) => {
      setUpdateInfo(payload)

      if (payload.status === 'checking') {
        setUpdateChecking(true)
        return
      }

      if (payload.status === 'not-available') {
        setUpdateChecking(false)
        if (manualUpdateCheck.current) {
          setStatus(`You're on the latest version (${payload.version})`)
          manualUpdateCheck.current = false
        }
        return
      }

      if (payload.status === 'available' || payload.status === 'error') {
        setUpdateChecking(false)
        manualUpdateCheck.current = false
      }
    })
    return () => unsubscribe?.()
  }, [])

  useEffect(() => {
    applyTheme(appSettings.theme, systemTheme)
  }, [appSettings.theme, systemTheme])

  useEffect(() => {
    if (appSettings.theme !== 'system') return undefined

    const unsubscribeNative = window.electronAPI?.onSystemThemeChanged?.((theme) => {
      setSystemTheme(theme)
    })

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onMediaChange = () => {
      setSystemTheme(media.matches ? 'dark' : 'light')
    }
    media.addEventListener('change', onMediaChange)

    return () => {
      unsubscribeNative?.()
      media.removeEventListener('change', onMediaChange)
    }
  }, [appSettings.theme])

  useEffect(() => {
    if (!showSettings) return
    window.electronAPI?.getLogInfo().then(setLogInfo)
  }, [showSettings])

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
    setUndoPaths([])
    setIsEditingTags(false)
    setManualDraft(null)
    setMetadataResults([])
    setProviderErrors([])
    setFilePath(path)
    setSelectedPaths([path])

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

  const replaceSelectedFilePath = useCallback((oldPath, newPath) => {
    if (!newPath || newPath === oldPath) return
    setFilePath(newPath)
    setFilePaths((prev) => {
      if (prev.length === 0) return [newPath]
      return prev.map((p) => (p === oldPath ? newPath : p))
    })
    setCurrentTags((prev) =>
      prev ? { ...prev, filePath: newPath, fileName: basename(newPath) } : prev,
    )
  }, [])

  /** Apply a map of old → new paths (from auto-rename or undo) to the file list and selection. */
  const applyPathRenames = useCallback((renames) => {
    if (renames.size === 0) return
    const mapPath = (p) => renames.get(p) ?? p
    setFilePaths((prev) => prev.map(mapPath))
    setSelectedPaths((prev) => prev.map(mapPath))
    setFilePath((prev) => (prev ? mapPath(prev) : prev))
  }, [])

  const isBatch = selectedPaths.length > 1
  const selectionKey = selectedPaths.join('|')
  // Merged tags are only valid for the selection they were read from.
  const batchLoaded = isBatch && batchKey === selectionKey && batchDraft != null

  /** Sidebar click: plain click opens one file, Ctrl/Cmd toggles, Shift selects a range. */
  const handleFileClick = (e, path) => {
    if (loading) return

    if (e.ctrlKey || e.metaKey) {
      const base = selectedPaths.length > 0 ? selectedPaths : filePath ? [filePath] : []
      const next = base.includes(path) ? base.filter((p) => p !== path) : [...base, path]
      if (next.length === 0) return
      if (next.length === 1) {
        if (next[0] === filePath) setSelectedPaths(next)
        else loadFile(next[0])
        return
      }
      setSelectedPaths(filePaths.filter((p) => next.includes(p)))
      return
    }

    if (e.shiftKey && filePath) {
      const from = filePaths.indexOf(filePath)
      const to = filePaths.indexOf(path)
      if (from !== -1 && to !== -1) {
        const [lo, hi] = from < to ? [from, to] : [to, from]
        const range = filePaths.slice(lo, hi + 1)
        if (range.length > 1) {
          setSelectedPaths(range)
          return
        }
      }
    }

    if (path === filePath) {
      setSelectedPaths([path])
      return
    }
    handleSelectFile(path)
  }

  const handleSelectAll = () => {
    if (filePaths.length > 1) setSelectedPaths(filePaths)
  }

  const handleClearSelection = () => {
    if (filePath) setSelectedPaths([filePath])
  }

  // Load and merge tags whenever the batch selection changes.
  useEffect(() => {
    if (selectedPaths.length < 2) return undefined

    let cancelled = false
    Promise.all(selectedPaths.map((p) => window.electronAPI.readMp3Tags(p)))
      .then((tagsList) => {
        if (cancelled) return
        const merged = mergeTags(tagsList, TAG_FIELDS.map(({ key }) => key))
        setBatchMerged(merged)
        setBatchDraft(createBatchDraft(merged))
        setBatchKey(selectionKey)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [selectedPaths, selectionKey, batchReloadToken])

  const updateBatchDraft = (key, value) => {
    setBatchDraft((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  /** Write the edited batch fields to every selected file, one at a time. */
  const handleBatchSave = async () => {
    if (!batchLoaded) return
    const changes = buildBatchChanges(batchDraft, batchMerged)
    if (Object.keys(changes).length === 0) {
      setError('No tag changes to save.')
      return
    }

    const targets = [...selectedPaths]
    const renames = new Map()
    const written = []
    const failures = []
    let activeTags = null

    setLoading(true)
    setError('')
    try {
      for (const [index, path] of targets.entries()) {
        setStatus(`Saving tags ${index + 1}/${targets.length}: ${basename(path)}`)
        try {
          const result = await window.electronAPI.writeMp3Tags(path, changes, false, null)
          const finalPath = result.filePath ?? path
          if (finalPath !== path) renames.set(path, finalPath)
          written.push(finalPath)
          if (path === filePath) activeTags = { ...result.tags, filePath: finalPath }
          if (result.renameWarning) failures.push(`${basename(path)}: rename skipped (${result.renameWarning})`)
        } catch (err) {
          failures.push(`${basename(path)}: ${err.message}`)
        }
      }

      applyPathRenames(renames)
      if (activeTags) setCurrentTags(activeTags)
      setUndoPaths(written)
      setBatchReloadToken((t) => t + 1)
      setStatus(`Tags saved to ${written.length} of ${targets.length} files (Undo available)`)
      if (failures.length > 0) setError(failures.join('; '))
    } finally {
      setLoading(false)
    }
  }

  const applyWriteResult = useCallback(
    (result, pathBeforeWrite, statusMessage) => {
      setUndoPaths([result.filePath ?? pathBeforeWrite])
      if (result.filePath && result.filePath !== pathBeforeWrite) {
        replaceSelectedFilePath(pathBeforeWrite, result.filePath)
        setCurrentTags({ ...result.tags, filePath: result.filePath })
      } else {
        setCurrentTags(result.tags)
      }
      let message = statusMessage(result.tags.fileName)
      if (result.renameWarning) {
        message += ` (Rename skipped: ${result.renameWarning})`
      }
      setStatus(message)
    },
    [replaceSelectedFilePath],
  )

  const startEditingTags = () => {
    if (!currentTags) return
    setManualDraft({
      ...Object.fromEntries(TAG_FIELDS.map(({ key }) => [key, currentTags[key] ?? ''])),
      lyrics: currentTags.lyrics ?? '',
    })
    setIsEditingTags(true)
    setError('')
  }

  const cancelEditingTags = () => {
    setIsEditingTags(false)
    setManualDraft(null)
  }

  const updateManualDraft = (key, value) => {
    setManualDraft((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  /** Save manually edited tags from the Current Tags panel. */
  const handleManualSaveTags = async () => {
    if (!filePath || !currentTags || !manualDraft) return

    const fieldsToWrite = {}
    TAG_FIELDS.forEach(({ key }) => {
      const next = manualDraft[key] ?? ''
      const prev = currentTags[key] ?? ''
      if (next !== prev) fieldsToWrite[key] = next
    })

    const nextLyrics = manualDraft.lyrics ?? ''
    const prevLyrics = currentTags.lyrics ?? ''
    if (nextLyrics !== prevLyrics) fieldsToWrite.lyrics = nextLyrics

    if (Object.keys(fieldsToWrite).length === 0) {
      setError('No tag changes to save.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const result = await window.electronAPI.writeMp3Tags(filePath, fieldsToWrite, false, null)
      applyWriteResult(result, filePath, (name) => `Tags saved manually: ${name} (Undo available)`)
      setIsEditingTags(false)
      setManualDraft(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
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
      const result = await window.electronAPI.writeMp3Tags(
        filePath,
        fieldsToWrite,
        includeArtwork && selectedTrack.artworkUrl,
        selectedTrack.artworkUrl,
      )
      applyWriteResult(
        result,
        filePath,
        (name) =>
          result.filePath && result.filePath !== filePath
            ? `Tags saved and renamed to ${name} (Undo available)`
            : `Tags saved: ${name} (backup created — Undo available)`,
      )
      resetSelection()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  /** Restore the pre-write backups for every file written by the last save. */
  const handleUndo = async () => {
    if (!canUndo) return
    setLoading(true)
    setError('')
    const renames = new Map()
    let lastRestored = null
    const failures = []
    try {
      for (const path of undoPaths) {
        try {
          const restored = await window.electronAPI.undoMp3Write(path)
          if (restored.filePath && restored.filePath !== path) renames.set(path, restored.filePath)
          if (path === filePath) lastRestored = restored
        } catch (err) {
          failures.push(`${basename(path)}: ${err.message}`)
        }
      }
      applyPathRenames(renames)
      if (lastRestored) {
        setCurrentTags(lastRestored)
        if (lastRestored.filePath) setFilePath(lastRestored.filePath)
      }
      setUndoPaths([])
      setIsEditingTags(false)
      setManualDraft(null)
      setBatchReloadToken((t) => t + 1)
      resetSelection()
      const restoredCount = undoPaths.length - failures.length
      setStatus(
        undoPaths.length === 1 && lastRestored
          ? `Reverted to backup: ${lastRestored.fileName}`
          : `Reverted ${restoredCount} file${restoredCount === 1 ? '' : 's'} to backup`,
      )
      if (failures.length > 0) setError(`Undo failed for ${failures.join('; ')}`)
    } finally {
      setLoading(false)
    }
  }

  /** Open dropped MP3 file(s) from the desktop (Electron exposes file.path). */
  const handleDrop = useCallback(async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const paths = [...e.dataTransfer.files]
      .map((file) => file.path)
      .filter((p) => p && p.toLowerCase().endsWith('.mp3'))

    if (paths.length === 0) {
      setError('Drop one or more .mp3 files')
      return
    }

    setError('')
    setStatus('')
    resetSelection()
    setMetadataResults([])
    setProviderErrors([])
    setUndoPaths([])
    setFolderPath(null)
    setFilePaths(paths)

    if (paths.length > 1) {
      setStatus(`Loaded ${paths.length} dropped MP3 files`)
    }

    await loadFile(paths[0])
  }, [loadFile, resetSelection])

  const handleSaveSettings = async (e) => {
    e.preventDefault()
    await window.electronAPI.saveAppSettings(appSettings)
    if (!apiConfig.hasEnvFile) {
      await window.electronAPI.saveApiConfig(apiConfig)
    }
    setShowSettings(false)
    setStatus('Settings saved.')
  }

  const handleCheckForUpdates = async () => {
    if (!window.electronAPI?.checkForUpdates) {
      setStatus('Update checks run in the installed desktop app.')
      return
    }

    manualUpdateCheck.current = true
    setUpdateChecking(true)
    setError('')
    try {
      const result = await window.electronAPI.checkForUpdates()
      if (result?.skipped) {
        setStatus('Update checks run in the installed app only (not dev mode).')
        setUpdateChecking(false)
        manualUpdateCheck.current = false
      } else if (result?.error) {
        setUpdateChecking(false)
        manualUpdateCheck.current = false
      }
    } catch (err) {
      setError(err.message)
      setUpdateChecking(false)
      manualUpdateCheck.current = false
    }
  }

  const handleDownloadUpdate = async () => {
    setError('')
    try {
      const result = await window.electronAPI.downloadUpdate()
      if (result?.error) {
        setUpdateChecking(false)
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const handleInstallUpdate = () => {
    window.electronAPI?.installUpdate?.()
  }

  const handleOpenReleasePage = async () => {
    const url = (await window.electronAPI?.getUpdateReleasePage?.()) ?? 'https://github.com/axcel-blade/mp3-tag-editor/releases/latest'
    window.open(url, '_blank', 'noopener')
  }

  const dismissUpdateBanner = () => {
    setUpdateInfo({ status: 'idle' })
  }

  const showUpdateBanner = ['available', 'downloading', 'downloaded', 'error'].includes(updateInfo.status)

  const renamePreview = useMemo(() => {
    const sampleBase = currentTags?.fileName
      ? currentTags.fileName.replace(/\.mp3$/i, '')
      : 'song'
    return buildRenameFilename(appSettings.renameTemplate, currentTags ?? SAMPLE_TAGS_FOR_PREVIEW, sampleBase)
  }, [appSettings.renameTemplate, currentTags])

  const showFileList = filePaths.length > 0 && (folderPath != null || filePaths.length > 1)

  return (
    <div
      className={`app ${isDragging ? 'app-dragging' : ''}`}
      onDragEnter={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setIsDragging(false)
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="drop-overlay" aria-hidden="true">
          <p>Drop MP3 files here</p>
        </div>
      )}
      <header className="header">
        <div className="header-left">
          <h1>MP3 Tag Editor</h1>
          <p className="subtitle">Musixmatch · MusicBrainz · Last.fm · iTunes · Spotify · Deezer</p>
        </div>
        <div className="header-actions">
          {canUndo && filePath && (
            <button type="button" className="btn btn-secondary" onClick={handleUndo} disabled={loading}>
              Undo Last Write
            </button>
          )}
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

      {showUpdateBanner && (
        <div className={`banner banner-update ${updateInfo.status === 'error' ? 'banner-warn' : 'banner-info'}`}>
          <div className="update-banner-content">
            {updateInfo.status === 'available' && (
              <>
                <span>
                  <strong>v{updateInfo.version}</strong> is available.
                </span>
                <div className="update-banner-actions">
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleDownloadUpdate}>
                    Download update
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleOpenReleasePage}>
                    View release
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={dismissUpdateBanner}>
                    Dismiss
                  </button>
                </div>
              </>
            )}
            {updateInfo.status === 'downloading' && (
              <>
                <span>Downloading update… {Math.round(updateInfo.percent ?? 0)}%</span>
                <div className="update-progress">
                  <div
                    className="update-progress-bar"
                    style={{ width: `${Math.min(100, Math.max(0, updateInfo.percent ?? 0))}%` }}
                  />
                </div>
              </>
            )}
            {updateInfo.status === 'downloaded' && (
              <>
                <span>
                  <strong>v{updateInfo.version}</strong> is ready to install.
                </span>
                <div className="update-banner-actions">
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleInstallUpdate}>
                    Restart and update
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={dismissUpdateBanner}>
                    Later
                  </button>
                </div>
              </>
            )}
            {updateInfo.status === 'error' && (
              <>
                <span>Could not check for updates{updateInfo.message ? `: ${updateInfo.message}` : '.'}</span>
                <div className="update-banner-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleOpenReleasePage}>
                    Download manually
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={dismissUpdateBanner}>
                    Dismiss
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
            <div className="file-list-panel-head">
              <div className="panel-header">
                <h2>{folderPath ? 'Folder' : 'Files'}</h2>
                <span className="file-count">{filePaths.length}</span>
              </div>
              {filePaths.length > 1 && (
                <div className="file-selection-bar">
                  <span className="muted">
                    {isBatch ? `${selectedPaths.length} selected` : 'Ctrl/Shift+click to multi-select'}
                  </span>
                  {isBatch ? (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={handleClearSelection} disabled={loading}>
                      Clear
                    </button>
                  ) : (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={handleSelectAll} disabled={loading}>
                      Select all
                    </button>
                  )}
                </div>
              )}
              {folderPath && (
                <p className="folder-path" title={folderPath}>
                  {folderPath}
                </p>
              )}
            </div>
            <div className="file-list-scroll">
              <ul className="file-list">
                {filePaths.map((path) => (
                  <li key={path}>
                    <button
                      type="button"
                      className={`file-item ${path === filePath ? 'active' : ''} ${isBatch && selectedPaths.includes(path) ? 'selected' : ''}`}
                      onClick={(e) => handleFileClick(e, path)}
                      aria-pressed={selectedPaths.includes(path)}
                      disabled={loading}
                      title={path}
                    >
                      {basename(path)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}

        <main className="main">
          {isBatch ? (
          <section className="panel current-tags batch-edit">
            <div className="panel-header">
              <h2>Batch Edit</h2>
              <span className="file-count">{selectedPaths.length} files</span>
              <div className="tag-edit-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => batchMerged && setBatchDraft(createBatchDraft(batchMerged))}
                  disabled={loading || !batchLoaded}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleBatchSave}
                  disabled={loading || !batchLoaded}
                >
                  Save to {selectedPaths.length} files
                </button>
              </div>
            </div>
            {!batchLoaded ? (
              <p className="loading">Reading tags…</p>
            ) : (
              <form
                className="manual-tag-form batch-tag-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  handleBatchSave()
                }}
              >
                <p className="settings-hint">
                  Fields showing {KEEP_PLACEHOLDER} differ between files and are left unchanged unless you type a value.
                </p>
                {TAG_FIELDS.map(({ key, label }) => {
                  const mixed = batchMerged?.[key]?.mixed
                  const kept = batchDraft[key] === null
                  return (
                    <label key={key} className="manual-tag-field">
                      <span>{label}</span>
                      <div className="batch-field-input">
                        <input
                          type="text"
                          value={batchDraft[key] ?? ''}
                          placeholder={kept ? KEEP_PLACEHOLDER : ''}
                          onChange={(e) => updateBatchDraft(key, e.target.value)}
                          disabled={loading}
                        />
                        {mixed && !kept && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => updateBatchDraft(key, null)}
                            title="Keep each file's own value"
                          >
                            Keep
                          </button>
                        )}
                      </div>
                    </label>
                  )
                })}
              </form>
            )}
          </section>
          ) : (
          <section className="panel current-tags">
            <div className="panel-header">
              <h2>Current Tags</h2>
              {currentTags && (
                <div className="tag-edit-actions">
                  {!isEditingTags ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={startEditingTags}
                      disabled={loading}
                    >
                      Edit tags
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={cancelEditingTags}
                        disabled={loading}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={handleManualSaveTags}
                        disabled={loading}
                      >
                        Save tags
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            {!currentTags ? (
              <p className="placeholder">Open an MP3 file, folder, or drag &amp; drop files here</p>
            ) : (
              <div className="current-tags-body">
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
                {isEditingTags && manualDraft ? (
                  <form
                    className="manual-tag-form"
                    onSubmit={(e) => {
                      e.preventDefault()
                      handleManualSaveTags()
                    }}
                  >
                    {TAG_FIELDS.map(({ key, label }) => (
                      <label key={key} className="manual-tag-field">
                        <span>{label}</span>
                        <input
                          type="text"
                          value={manualDraft[key] ?? ''}
                          onChange={(e) => updateManualDraft(key, e.target.value)}
                          disabled={loading}
                        />
                      </label>
                    ))}
                    <label className="manual-tag-field manual-tag-field-lyrics">
                      <span>Lyrics</span>
                      <textarea
                        value={manualDraft.lyrics ?? ''}
                        onChange={(e) => updateManualDraft('lyrics', e.target.value)}
                        disabled={loading}
                        rows={5}
                        placeholder="Unsynchronised lyrics (USLT)"
                      />
                    </label>
                    <div className="manual-tag-meta">
                      <span className="manual-tag-meta-label">File</span>
                      <span className="file-path">{currentTags.fileName}</span>
                    </div>
                  </form>
                ) : (
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
                )}
                </div>
              </div>
            )}
          </section>
          )}

          <section className="panel metadata-results">
            <div className="metadata-results-head">
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
            </div>

            <div className="metadata-results-body">
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
            </div>
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
            <h2>Settings</h2>
            <p className="modal-desc">
              MusicBrainz, iTunes, and Deezer work without keys. Optional keys go in <code>.env</code> or below.
            </p>
            {apiConfig.hasEnvFile && (
              <p className="modal-note">Using credentials from .env (API key fields are ignored while .env is set).</p>
            )}

            <form onSubmit={handleSaveSettings}>
              <fieldset className="settings-section">
                <legend>Appearance</legend>
                <label className="theme-select-label">
                  Theme
                  <select
                    className="theme-select"
                    value={appSettings.theme}
                    onChange={(e) =>
                      setAppSettings((s) => ({ ...s, theme: normalizeThemeMode(e.target.value) }))
                    }
                    aria-label="Theme"
                  >
                    {THEME_OPTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                {appSettings.theme === 'system' && (
                  <p className="theme-select-hint">Follow your device light/dark setting</p>
                )}
              </fieldset>

              <fieldset className="settings-section">
                <legend>Auto file rename</legend>
                <p className="modal-desc">
                  After applying tags, rename the MP3 using a custom template. Off by default.
                </p>
                <label className="settings-checkbox">
                  <input
                    type="checkbox"
                    checked={appSettings.autoRenameEnabled}
                    onChange={(e) =>
                      setAppSettings((s) => ({ ...s, autoRenameEnabled: e.target.checked }))
                    }
                  />
                  <span>Rename file after applying tags</span>
                </label>
                <label>
                  Filename template
                  <input
                    type="text"
                    value={appSettings.renameTemplate}
                    onChange={(e) =>
                      setAppSettings((s) => ({ ...s, renameTemplate: e.target.value }))
                    }
                    placeholder="{artist} - {title}"
                    disabled={!appSettings.autoRenameEnabled}
                  />
                </label>
                <p className="settings-hint">
                  Placeholders: {RENAME_PLACEHOLDERS.join(', ')}
                </p>
                {appSettings.autoRenameEnabled && (
                  <p className="modal-note rename-preview">
                    Preview: <code>{renamePreview}</code>
                  </p>
                )}
              </fieldset>

              <fieldset className="settings-section">
                <legend>API keys</legend>
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
              </fieldset>

              <fieldset className="settings-section">
                <legend>Updates</legend>
                <p className="modal-desc">
                  The installed app checks GitHub Releases for new versions on startup.
                </p>
                {appVersion && (
                  <p className="settings-hint">
                    Current version: <code>v{appVersion}</code>
                  </p>
                )}
                <button
                  type="button"
                  className="btn btn-secondary settings-log-btn"
                  onClick={handleCheckForUpdates}
                  disabled={updateChecking}
                >
                  {updateChecking ? 'Checking…' : 'Check for updates'}
                </button>
              </fieldset>

              <fieldset className="settings-section">
                <legend>Logs</legend>
                <p className="modal-desc">
                  MP3 Tag Editor writes daily log files for tag reads, writes, searches, and errors.
                </p>
                {logInfo?.currentLog && (
                  <p className="settings-hint log-path">
                    Current: <code>{logInfo.currentLog}</code>
                  </p>
                )}
                <button
                  type="button"
                  className="btn btn-secondary settings-log-btn"
                  onClick={() => window.electronAPI?.openLogFolder()}
                >
                  Open Log Folder
                </button>
              </fieldset>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSettings(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
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
