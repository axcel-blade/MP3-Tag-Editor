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
  getLogInfo: () => ipcRenderer.invoke('logs:getInfo'),
  openLogFolder: () => ipcRenderer.invoke('logs:openFolder'),
})
