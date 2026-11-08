import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { buildRenameFilename, DEFAULT_RENAME_TEMPLATE, RENAME_PLACEHOLDERS } from '@shared/rename-template.js'
import { KEEP_PLACEHOLDER, buildBatchChanges, createBatchDraft, mergeTags } from '@shared/batch-tags.js'
import { copyTags, findReplaceTags } from '@shared/tag-transforms.js'
import { autoNumberTracks } from '@shared/auto-number.js'
import { COVER_SIZE_OPTIONS } from '@shared/cover-image.js'
import { extensionOf, isSupportedAudio, stemOf } from '@shared/audio-formats.js'
import { EXPORT_FORMATS, buildTagExport, filterFiles } from '@shared/tag-export.js'
import { IGNORE_PLACEHOLDER, compileFilenamePattern, filenameTagChanges } from '@shared/filename-tags.js'
import { THEME_OPTIONS, applyTheme, normalizeThemeMode } from './theme.js'
import './App.css'

const SAMPLE_TAGS_FOR_PREVIEW = {
  artist: 'Artist Name',
  title: 'Song Title',
  album: 'Album Name',
  year: '2024',
  genre: 'Pop',
  trackNumber: '03',
  discNumber: '1',
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
  { key: 'discNumber', label: 'Disc #' },
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

/** Tabs in the tag tools popup. */
const TAG_TOOL_MODES = [
  { key: 'replace', label: 'Find & Replace' },
  { key: 'copy', label: 'Copy Fields' },
  { key: 'filename', label: 'Tags from Filename' },
  { key: 'number', label: 'Auto-Number' },
  { key: 'rename', label: 'Rename Files' },
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
  /** Open Find & Replace / Copy Fields tool: { mode: 'replace' | 'copy', entries: [{ path, tags }] | null }. */
  const [tagTool, setTagTool] = useState(null)
  /** Sidebar filter text: plain words or field:value terms. */
  const [fileFilter, setFileFilter] = useState('')
  /** Max edge (px) when embedding a cover from a file; 0 keeps the original size. */
  const [coverMaxSize, setCoverMaxSize] = useState(0)
  /** Tags for every listed file, for filtering: { key, tagsByPath } (key ties it to the list + last write). */
  const [libraryTags, setLibraryTags] = useState(null)
  const [toolOptions, setToolOptions] = useState({
    fields: TAG_FIELDS.map(({ key }) => key),
    find: '',
    replace: '',
    useRegex: false,
    caseSensitive: false,
    target: 'albumArtist',
    format: '{artist}',
    filenamePattern: '{artist} - {title}',
    renameTemplate: DEFAULT_RENAME_TEMPLATE,
    numberStart: '1',
    numberPadding: '2',
    numberIncludeTotal: false,
    numberResetBy: 'none',
    numberDiscs: false,
    clearSource: false,
  })
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
      setStatus(`Found ${result.paths.length} audio file${result.paths.length === 1 ? '' : 's'}`)
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
      setError('No supported audio files found in the selected folder.')
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
  const fieldKeys = useMemo(() => TAG_FIELDS.map(({ key }) => key), [])
  const libraryKey = `${filePaths.join('|')}#${batchReloadToken}`
  const libraryTagsByPath = libraryTags?.key === libraryKey ? libraryTags.tagsByPath : null
  const filterActive = fileFilter.trim() !== ''
  const visiblePaths = useMemo(
    () => (filterActive ? filterFiles(filePaths, fileFilter, libraryTagsByPath ?? {}, fieldKeys) : filePaths),
    [filterActive, filePaths, fileFilter, libraryTagsByPath, fieldKeys],
  )

  /** Read tags for every listed file (cached until the list changes or tags are written). */
  const readLibraryTags = useCallback(async () => {
    if (libraryTagsByPath) return libraryTagsByPath
    const tagsList = await Promise.all(filePaths.map((p) => window.electronAPI.readMp3Tags(p)))
    const tagsByPath = Object.fromEntries(filePaths.map((p, i) => [p, tagsList[i]]))
    setLibraryTags({ key: libraryKey, tagsByPath })
    return tagsByPath
  }, [libraryTagsByPath, filePaths, libraryKey])

  // Filtering by tag needs every file's tags; load them once the user starts typing.
  useEffect(() => {
    if (!filterActive || libraryTagsByPath || filePaths.length === 0) return undefined
    let cancelled = false
    Promise.all(filePaths.map((p) => window.electronAPI.readMp3Tags(p)))
      .then((tagsList) => {
        if (cancelled) return
        setLibraryTags({ key: libraryKey, tagsByPath: Object.fromEntries(filePaths.map((p, i) => [p, tagsList[i]])) })
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [filterActive, libraryTagsByPath, filePaths, libraryKey])

  /** Files a cover action applies to: the batch selection, or the open file. */
  const coverTargets = isBatch ? selectedPaths : filePath ? [filePath] : []

  /** Apply the result of a cover IPC call ({ written, failures }) to UI state. */
  const applyCoverResult = (result, doneMessage) => {
    const active = result.written.find((w) => w.filePath === filePath)
    if (active) setCurrentTags({ ...active.tags, filePath: active.filePath })
    setUndoPaths(result.written.map((w) => w.filePath))
    setBatchReloadToken((t) => t + 1)
    setStatus(`${doneMessage} (${result.written.length} of ${result.written.length + result.failures.length} files, Undo available)`)
    if (result.failures.length > 0) {
      setError(result.failures.map((f) => `${basename(f.filePath)}: ${f.error}`).join('; '))
    }
  }

  const handleSetCover = async () => {
    if (coverTargets.length === 0) return
    setError('')
    const imagePath = await window.electronAPI.pickCoverImage()
    if (!imagePath) return
    setLoading(true)
    setStatus(`Embedding ${basename(imagePath)}…`)
    try {
      const result = await window.electronAPI.setCoverFromFile(coverTargets, imagePath, coverMaxSize)
      applyCoverResult(result, `Cover set from ${basename(imagePath)} (${result.width}×${result.height})`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveCover = async () => {
    if (coverTargets.length === 0) return
    setError('')
    setLoading(true)
    try {
      applyCoverResult(await window.electronAPI.removeCover(coverTargets), 'Cover removed')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleExportCover = async () => {
    if (!filePath) return
    setError('')
    try {
      const result = await window.electronAPI.exportCover(filePath)
      if (result?.filePath) {
        setStatus(`Cover exported to ${basename(result.filePath)}`)
        window.electronAPI.revealExport?.(result.filePath)
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const coverControls = (
    <div className="cover-actions">
      <button type="button" className="btn btn-secondary btn-sm" onClick={handleSetCover} disabled={loading}>
        {isBatch ? `Set cover on ${selectedPaths.length} files…` : 'Set cover…'}
      </button>
      <select
        className="theme-select cover-size-select"
        value={coverMaxSize}
        onChange={(e) => setCoverMaxSize(Number(e.target.value))}
        aria-label="Maximum cover size"
        title="Shrink large images before embedding"
      >
        {COVER_SIZE_OPTIONS.map((size) => (
          <option key={size} value={size}>
            {size === 0 ? 'Original size' : `Max ${size}px`}
          </option>
        ))}
      </select>
      {!isBatch && currentTags?.picture?.data && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={handleExportCover} disabled={loading}>
          Export cover
        </button>
      )}
      {(isBatch || currentTags?.picture?.data) && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={handleRemoveCover} disabled={loading}>
          {isBatch ? 'Remove covers' : 'Remove cover'}
        </button>
      )}
    </div>
  )

  /** Export tags of the selected files (or every visible file) to CSV / HTML / JSON. */
  const handleExport = async (format) => {
    const spec = EXPORT_FORMATS.find((f) => f.key === format)
    if (!spec) return
    const paths = isBatch ? selectedPaths : visiblePaths
    if (paths.length === 0) return
    setError('')
    try {
      const tagsByPath = await readLibraryTags()
      const entries = paths.map((path) => ({ path, tags: tagsByPath[path] }))
      const title = folderPath ? `MP3 Tag Report — ${basename(folderPath)}` : 'MP3 Tag Report'
      const content = buildTagExport(format, entries, TAG_FIELDS, { title })
      const baseName = folderPath ? basename(folderPath) : 'tag-report'
      const result = await window.electronAPI.saveExport(format, `${baseName}.${spec.extension}`, content)
      if (result?.filePath) {
        setStatus(`Exported ${paths.length} file${paths.length === 1 ? '' : 's'} to ${basename(result.filePath)}`)
        window.electronAPI.revealExport?.(result.filePath)
      }
    } catch (err) {
      setError(err.message)
    }
  }
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
      const from = visiblePaths.indexOf(filePath)
      const to = visiblePaths.indexOf(path)
      if (from !== -1 && to !== -1) {
        const [lo, hi] = from < to ? [from, to] : [to, from]
        const range = visiblePaths.slice(lo, hi + 1)
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
    if (visiblePaths.length > 1) setSelectedPaths(visiblePaths)
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

  /**
   * Write per-file tag changes one file at a time ([{ path, changes }]).
   * Keeps going past failures, then updates paths, undo, and the active file's tags.
   */
  const writeChangesToFiles = async (entries) => {
    const renames = new Map()
    const written = []
    const failures = []
    let activeTags = null

    setLoading(true)
    setError('')
    try {
      for (const [index, { path, changes }] of entries.entries()) {
        setStatus(`Saving tags ${index + 1}/${entries.length}: ${basename(path)}`)
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
      setStatus(`Tags saved to ${written.length} of ${entries.length} file${entries.length === 1 ? '' : 's'} (Undo available)`)
      if (failures.length > 0) setError(failures.join('; '))
    } finally {
      setLoading(false)
    }
  }

  /** Write the edited batch fields to every selected file. */
  const handleBatchSave = async () => {
    if (!batchLoaded) return
    const changes = buildBatchChanges(batchDraft, batchMerged)
    if (Object.keys(changes).length === 0) {
      setError('No tag changes to save.')
      return
    }
    await writeChangesToFiles(selectedPaths.map((path) => ({ path, changes })))
  }

  /** Open the Find & Replace / Copy Fields tool for the selected files (or the open file). */
  const openTagTool = async (mode) => {
    const targets = selectedPaths.length > 0 ? selectedPaths : filePath ? [filePath] : []
    if (targets.length === 0) return
    setError('')
    if (mode === 'rename') updateToolOptions('renameTemplate', appSettings.renameTemplate || DEFAULT_RENAME_TEMPLATE)
    setTagTool({ mode, entries: null })
    try {
      const tagsList = await Promise.all(targets.map((p) => window.electronAPI.readMp3Tags(p)))
      setTagTool({ mode, entries: targets.map((path, i) => ({ path, tags: tagsList[i] })) })
    } catch (err) {
      setTagTool(null)
      setError(err.message)
    }
  }

  const updateToolOptions = (key, value) => {
    setToolOptions((prev) => ({ ...prev, [key]: value }))
  }

  const toggleToolField = (key) => {
    setToolOptions((prev) => ({
      ...prev,
      fields: prev.fields.includes(key) ? prev.fields.filter((k) => k !== key) : [...prev.fields, key],
    }))
  }

  /** Live preview of what the active tool would change, per file. */
  const toolPreview = useMemo(() => {
    if (!tagTool?.entries) return { rows: [], error: '' }
    try {
      const compiled =
        tagTool.mode === 'filename'
          ? compileFilenamePattern(toolOptions.filenamePattern, TAG_FIELDS.map(({ key }) => key))
          : null
      const computeToolChanges = (path, tags) => {
        switch (tagTool.mode) {
          case 'replace':
            return findReplaceTags(tags, toolOptions)
          case 'copy':
            return copyTags(tags, toolOptions)
          case 'filename':
            return filenameTagChanges(compiled, path, tags)
          case 'rename': {
            const next = buildRenameFilename(toolOptions.renameTemplate, tags, stemOf(path), {
              extension: extensionOf(path),
            })
            return next === basename(path) ? {} : { fileName: next }
          }
          default:
            return {}
        }
      }
      if (tagTool.mode === 'number') {
        const rows = autoNumberTracks(tagTool.entries, {
          start: toolOptions.numberStart,
          padding: toolOptions.numberPadding,
          includeTotal: toolOptions.numberIncludeTotal,
          resetBy: toolOptions.numberResetBy,
          numberDiscs: toolOptions.numberDiscs,
        }).filter((row) => Object.keys(row.changes).length > 0)
        return { rows, error: '' }
      }
      const rows = tagTool.entries
        .map(({ path, tags }) => ({ path, tags, changes: computeToolChanges(path, tags) }))
        .filter((row) => Object.keys(row.changes).length > 0)
      return { rows, error: '' }
    } catch (err) {
      return { rows: [], error: err.message }
    }
  }, [tagTool, toolOptions])

  const handleApplyTagTool = async () => {
    if (toolPreview.rows.length === 0) return
    const mode = tagTool.mode
    const entries = toolPreview.rows.map(({ path, changes }) => ({ path, changes }))
    setTagTool(null)
    if (mode === 'rename') await renameFiles(entries.map(({ path }) => path))
    else await writeChangesToFiles(entries)
  }

  /** Rename files on disk from their tags using the rename template from the tool. */
  const renameFiles = async (paths) => {
    const renames = new Map()
    const failures = []
    setLoading(true)
    setError('')
    try {
      for (const [index, path] of paths.entries()) {
        setStatus(`Renaming ${index + 1}/${paths.length}: ${basename(path)}`)
        try {
          const result = await window.electronAPI.renameMp3File(path, toolOptions.renameTemplate)
          if (result.filePath !== path) renames.set(path, result.filePath)
        } catch (err) {
          failures.push(`${basename(path)}: ${err.message}`)
        }
      }
      applyPathRenames(renames)
      if (filePath && renames.has(filePath)) {
        const newPath = renames.get(filePath)
        setCurrentTags((prev) => (prev ? { ...prev, filePath: newPath, fileName: basename(newPath) } : prev))
      }
      // Undo restores tag backups by path; the old paths no longer exist after a rename.
      setUndoPaths((prev) => prev.map((p) => renames.get(p) ?? p))
      setStatus(`Renamed ${renames.size} of ${paths.length} file${paths.length === 1 ? '' : 's'}`)
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

  /** Write checked fields (and optional artwork/lyrics) to the open audio file. */
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

  /** Open dropped audio file(s) from the desktop (Electron exposes file.path). */
  const handleDrop = useCallback(async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const paths = [...e.dataTransfer.files]
      .map((file) => file.path)
      .filter((p) => p && isSupportedAudio(p))

    if (paths.length === 0) {
      setError('Drop one or more audio files (MP3, FLAC, M4A, Ogg, Opus, WAV, AIFF)')
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
      setStatus(`Loaded ${paths.length} dropped audio files`)
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
    const sampleBase = currentTags?.fileName ? stemOf(currentTags.fileName) : 'song'
    return buildRenameFilename(appSettings.renameTemplate, currentTags ?? SAMPLE_TAGS_FOR_PREVIEW, sampleBase, {
      extension: currentTags?.fileName ? extensionOf(currentTags.fileName) : 'mp3',
    })
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
          <p>Drop audio files here</p>
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
                <span className="file-count">
                  {filterActive ? `${visiblePaths.length}/${filePaths.length}` : filePaths.length}
                </span>
                <select
                  className="theme-select export-select"
                  value=""
                  onChange={(e) => handleExport(e.target.value)}
                  disabled={loading}
                  aria-label="Export tags"
                  title={isBatch ? 'Export the selected files' : 'Export the listed files'}
                >
                  <option value="" disabled>
                    Export…
                  </option>
                  {EXPORT_FORMATS.map(({ key, label }) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="search"
                className="file-filter"
                value={fileFilter}
                onChange={(e) => setFileFilter(e.target.value)}
                placeholder="Filter: text or artist:name, year:1999"
                aria-label="Filter files"
              />
              {filterActive && !libraryTagsByPath && <p className="muted file-filter-hint">Reading tags…</p>}
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
                {visiblePaths.map((path) => (
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
              {filterActive && visiblePaths.length === 0 && <p className="placeholder">No files match the filter</p>}
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
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => openTagTool('replace')} disabled={loading}>
                  Find &amp; Replace
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => openTagTool('copy')} disabled={loading}>
                  Copy Fields
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => openTagTool('filename')} disabled={loading}>
                  From Filename
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => openTagTool('number')} disabled={loading}>
                  Auto-Number
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => openTagTool('rename')} disabled={loading}>
                  Rename
                </button>
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
                {coverControls}
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
                  {!isEditingTags && (
                    <>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openTagTool('replace')} disabled={loading}>
                        Find &amp; Replace
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openTagTool('copy')} disabled={loading}>
                        Copy Fields
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openTagTool('filename')} disabled={loading}>
                        From Filename
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openTagTool('number')} disabled={loading}>
                        Auto-Number
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openTagTool('rename')} disabled={loading}>
                        Rename
                      </button>
                    </>
                  )}
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
              <p className="placeholder">Open an audio file (MP3, FLAC, M4A, Ogg…), a folder, or drag &amp; drop files here</p>
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
                    {!isEditingTags && coverControls}
                  </div>
                ) : (
                  <div className="cover-wrap">
                    <div className="cover cover-placeholder">No cover</div>
                    {!isEditingTags && coverControls}
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

      {tagTool &&
        createPortal(
          <div className="modal-overlay" onClick={() => setTagTool(null)} role="presentation">
            <div
              className="apply-modal tag-tool-modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="tag-tool-title"
            >
              <div className="apply-modal-header">
                <h2 id="tag-tool-title">{TAG_TOOL_MODES.find((m) => m.key === tagTool.mode)?.label}</h2>
                <button type="button" className="modal-close" onClick={() => setTagTool(null)} aria-label="Close">
                  ×
                </button>
              </div>
              <div className="source-filters">
                {TAG_TOOL_MODES.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    className={`source-chip ${tagTool.mode === key ? 'active' : ''}`}
                    onClick={() => openTagTool(key)}
                  >
                    {label}
                  </button>
                ))}
                <span className="muted">
                  {tagTool.entries
                    ? `${tagTool.entries.length} file${tagTool.entries.length === 1 ? '' : 's'}`
                    : 'Reading tags…'}
                </span>
              </div>

              {tagTool.mode === 'replace' ? (
                <div className="tag-tool-form">
                  <label>
                    Find
                    <input
                      type="text"
                      value={toolOptions.find}
                      onChange={(e) => updateToolOptions('find', e.target.value)}
                      autoFocus
                    />
                  </label>
                  <label>
                    Replace with
                    <input
                      type="text"
                      value={toolOptions.replace}
                      onChange={(e) => updateToolOptions('replace', e.target.value)}
                    />
                  </label>
                  <div className="tag-tool-options">
                    <label className="settings-checkbox">
                      <input
                        type="checkbox"
                        checked={toolOptions.useRegex}
                        onChange={(e) => updateToolOptions('useRegex', e.target.checked)}
                      />
                      <span>Regular expression ($1, $2… in replacement)</span>
                    </label>
                    <label className="settings-checkbox">
                      <input
                        type="checkbox"
                        checked={toolOptions.caseSensitive}
                        onChange={(e) => updateToolOptions('caseSensitive', e.target.checked)}
                      />
                      <span>Match case</span>
                    </label>
                  </div>
                  <div className="tag-tool-options">
                    <span className="search-sources-label">In fields</span>
                    {TAG_FIELDS.map(({ key, label }) => (
                      <label key={key} className="settings-checkbox">
                        <input
                          type="checkbox"
                          checked={toolOptions.fields.includes(key)}
                          onChange={() => toggleToolField(key)}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : tagTool.mode === 'filename' ? (
                <div className="tag-tool-form">
                  <label>
                    Filename pattern
                    <input
                      type="text"
                      value={toolOptions.filenamePattern}
                      onChange={(e) => updateToolOptions('filenamePattern', e.target.value)}
                      placeholder="{trackNumber} - {artist} - {title}"
                      autoFocus
                    />
                  </label>
                  <p className="settings-hint">
                    Placeholders: {TAG_FIELDS.map(({ key }) => `{${key}}`).join(', ')}, {`{${IGNORE_PLACEHOLDER}}`} to skip text.
                    Use <code>\</code> to read folder names too, e.g. <code>{String.raw`{artist}\{album}\{title}`}</code>.
                    Files whose names don&apos;t fit the pattern are skipped.
                  </p>
                </div>
              ) : tagTool.mode === 'number' ? (
                <div className="tag-tool-form">
                  <div className="tag-tool-options">
                    <label>
                      Start at
                      <input
                        type="number"
                        min="0"
                        value={toolOptions.numberStart}
                        onChange={(e) => updateToolOptions('numberStart', e.target.value)}
                      />
                    </label>
                    <label>
                      Digits (leading zeros)
                      <input
                        type="number"
                        min="0"
                        max="4"
                        value={toolOptions.numberPadding}
                        onChange={(e) => updateToolOptions('numberPadding', e.target.value)}
                      />
                    </label>
                    <label>
                      Restart numbering when
                      <select
                        className="theme-select"
                        value={toolOptions.numberResetBy}
                        onChange={(e) => updateToolOptions('numberResetBy', e.target.value)}
                      >
                        <option value="none">Never</option>
                        <option value="folder">Folder changes</option>
                        <option value="album">Album changes</option>
                      </select>
                    </label>
                  </div>
                  <div className="tag-tool-options">
                    <label className="settings-checkbox">
                      <input
                        type="checkbox"
                        checked={toolOptions.numberIncludeTotal}
                        onChange={(e) => updateToolOptions('numberIncludeTotal', e.target.checked)}
                      />
                      <span>Include total (e.g. 03/12)</span>
                    </label>
                    <label className="settings-checkbox">
                      <input
                        type="checkbox"
                        checked={toolOptions.numberDiscs}
                        onChange={(e) => updateToolOptions('numberDiscs', e.target.checked)}
                        disabled={toolOptions.numberResetBy === 'none'}
                      />
                      <span>Also set disc numbers (one disc per group)</span>
                    </label>
                  </div>
                  <p className="settings-hint">Files are numbered in the order they appear in the file list.</p>
                </div>
              ) : tagTool.mode === 'rename' ? (
                <div className="tag-tool-form">
                  <label>
                    Filename template
                    <input
                      type="text"
                      value={toolOptions.renameTemplate}
                      onChange={(e) => updateToolOptions('renameTemplate', e.target.value)}
                      placeholder={DEFAULT_RENAME_TEMPLATE}
                      autoFocus
                    />
                  </label>
                  <p className="settings-hint">Placeholders: {RENAME_PLACEHOLDERS.join(', ')}</p>
                </div>
              ) : (
                <div className="tag-tool-form">
                  <label>
                    Target field
                    <select
                      className="theme-select"
                      value={toolOptions.target}
                      onChange={(e) => updateToolOptions('target', e.target.value)}
                    >
                      {TAG_FIELDS.map(({ key, label }) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Value format
                    <input
                      type="text"
                      value={toolOptions.format}
                      onChange={(e) => updateToolOptions('format', e.target.value)}
                      placeholder="{artist}"
                    />
                  </label>
                  <p className="settings-hint">
                    Placeholders: {TAG_FIELDS.map(({ key }) => `{${key}}`).join(', ')} — combine them, e.g.{' '}
                    <code>{'{artist} - {album}'}</code>
                  </p>
                  <label className="settings-checkbox">
                    <input
                      type="checkbox"
                      checked={toolOptions.clearSource}
                      onChange={(e) => updateToolOptions('clearSource', e.target.checked)}
                    />
                    <span>Move (clear the source fields afterwards)</span>
                  </label>
                </div>
              )}

              <div className="tag-tool-preview">
                {toolPreview.error ? (
                  <p className="placeholder">{toolPreview.error}</p>
                ) : !tagTool.entries ? null : toolPreview.rows.length === 0 ? (
                  <p className="placeholder">No changes</p>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>File</th>
                        <th>Field</th>
                        <th>Before</th>
                        <th>After</th>
                      </tr>
                    </thead>
                    <tbody>
                      {toolPreview.rows.flatMap(({ path, tags, changes }) =>
                        Object.entries(changes).map(([key, value]) => (
                          <tr key={`${path}:${key}`}>
                            <td title={path}>{basename(path)}</td>
                            <td>{key === 'fileName' ? 'Filename' : (TAG_FIELDS.find((f) => f.key === key)?.label ?? key)}</td>
                            <td className="muted">{(key === 'fileName' ? basename(path) : tags[key]) || '—'}</td>
                            <td>{value || '—'}</td>
                          </tr>
                        )),
                      )}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="apply-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setTagTool(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleApplyTagTool}
                  disabled={loading || toolPreview.rows.length === 0}
                >
                  {tagTool.mode === 'rename' ? 'Rename' : 'Apply to'} {toolPreview.rows.length} file
                  {toolPreview.rows.length === 1 ? '' : 's'}
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
                  After applying tags, rename the file using a custom template. Off by default.
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
