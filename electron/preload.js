import { contextBridge, ipcRenderer } from 'electron'

/** Secure bridge exposed to the React renderer as window.electronAPI. */
contextBridge.exposeInMainWorld('electronAPI', {
  openMp3File: () => ipcRenderer.invoke('dialog:openMp3'),
  openMp3Folder: () => ipcRenderer.invoke('dialog:openFolder'),
  readMp3Tags: (filePath) => ipcRenderer.invoke('mp3:readTags', filePath),
  writeMp3Tags: (filePath, fields, includeArtwork, artworkUrl) =>
    ipcRenderer.invoke('mp3:writeTags', filePath, fields, includeArtwork, artworkUrl),
  undoMp3Write: (filePath) => ipcRenderer.invoke('mp3:undoWrite', filePath),
  searchMetadata: (tags, providers) => ipcRenderer.invoke('metadata:search', tags, providers),
  searchMetadataCustom: (query, providers) => ipcRenderer.invoke('metadata:searchCustom', query, providers),
  getApiConfig: () => ipcRenderer.invoke('metadata:getConfig'),
  saveApiConfig: (config) => ipcRenderer.invoke('metadata:saveConfig', config),
  getAppSettings: () => ipcRenderer.invoke('settings:get'),
  saveAppSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  getSystemTheme: () => ipcRenderer.invoke('theme:getSystem'),
  onSystemThemeChanged: (callback) => {
    const listener = (_event, theme) => callback(theme)
    ipcRenderer.on('theme:systemChanged', listener)
    return () => ipcRenderer.removeListener('theme:systemChanged', listener)
  },
  getLogInfo: () => ipcRenderer.invoke('logs:getInfo'),
  openLogFolder: () => ipcRenderer.invoke('logs:openFolder'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  getUpdateReleasePage: () => ipcRenderer.invoke('update:getReleasePage'),
  getAppVersion: () => ipcRenderer.invoke('update:getVersion'),
  onUpdateStatus: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('update:status', listener)
    return () => ipcRenderer.removeListener('update:status', listener)
  },
})
