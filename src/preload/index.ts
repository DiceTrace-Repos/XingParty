import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { ClientSettingsUpdate, RecognitionFramePayload } from '../shared/types'

// Custom APIs for renderer
const api = {
  getBootstrapState: () => ipcRenderer.invoke('app:get-bootstrap-state'),
  updateClientSettings: (update: ClientSettingsUpdate) =>
    ipcRenderer.invoke('app:update-client-settings', update),
  selectGamePath: (title: string) => ipcRenderer.invoke('app:select-game-path', title),
  getAppLogs: () => ipcRenderer.invoke('app:get-logs'),
  clearAppLogs: () => ipcRenderer.invoke('app:clear-logs'),
  exportAppLogs: () => ipcRenderer.invoke('app:export-logs'),
  refreshGameCatalog: () => ipcRenderer.invoke('games:refresh-catalog'),
  refreshGameRoles: () => ipcRenderer.invoke('resources:refresh-game-roles'),
  setActiveGame: (key: string) => ipcRenderer.invoke('games:set-active', key),
  startRecognition: (key: string) => ipcRenderer.invoke('recognition:start', key),
  prepareVideoRecognition: (key: string) => ipcRenderer.invoke('recognition:prepare-video', key),
  getVideoFilePath: (file: File) => webUtils.getPathForFile(file),
  startVideoFileRecognition: (key: string, filePath: string) =>
    ipcRenderer.invoke('recognition:start-video-file', key, filePath),
  checkRecognitionTarget: () => ipcRenderer.invoke('recognition:check-target'),
  submitRecognitionFrame: (payload: RecognitionFramePayload) =>
    ipcRenderer.invoke('recognition:submit-frame', payload),
  stopRecognition: () => ipcRenderer.invoke('recognition:stop')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
