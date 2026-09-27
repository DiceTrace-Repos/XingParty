import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { RecognitionFramePayload } from '../shared/types'

// Custom APIs for renderer
const api = {
  getBootstrapState: () => ipcRenderer.invoke('app:get-bootstrap-state'),
  getAppLogs: () => ipcRenderer.invoke('app:get-logs'),
  clearAppLogs: () => ipcRenderer.invoke('app:clear-logs'),
  exportAppLogs: () => ipcRenderer.invoke('app:export-logs'),
  refreshGameCatalog: () => ipcRenderer.invoke('games:refresh-catalog'),
  setActiveGame: (key: string) => ipcRenderer.invoke('games:set-active', key),
  startMockRecognition: (key: string) => ipcRenderer.invoke('recognition:start-mock', key),
  prepareRecognitionCapture: (key: string) =>
    ipcRenderer.invoke('recognition:prepare-capture', key),
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
