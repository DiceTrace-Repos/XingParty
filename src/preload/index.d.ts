import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  AppLogEntry,
  BootstrapState,
  ClientSettingsUpdate,
  RecognitionCaptureTarget,
  RecognitionFramePayload,
  RecognitionTargetHealth
} from '../shared/types'

export interface RecognitionCaptureSession {
  state: BootstrapState
  target: RecognitionCaptureTarget
}

export type RecognitionStartSession =
  | {
      mode: 'mock'
      state: BootstrapState
    }
  | {
      mode: 'capture'
      state: BootstrapState
      target: RecognitionCaptureTarget
    }

export interface ExportLogsResult {
  canceled: boolean
  filePath?: string
}

export interface XingPartyAPI {
  getBootstrapState: () => Promise<BootstrapState>
  updateClientSettings: (update: ClientSettingsUpdate) => Promise<BootstrapState>
  selectGamePath: (title: string) => Promise<string | undefined>
  getAppLogs: () => Promise<AppLogEntry[]>
  clearAppLogs: () => Promise<AppLogEntry[]>
  exportAppLogs: () => Promise<ExportLogsResult>
  refreshGameCatalog: () => Promise<BootstrapState>
  refreshGameRoles: () => Promise<BootstrapState>
  setActiveGame: (key: string) => Promise<BootstrapState>
  startRecognition: (key: string) => Promise<RecognitionStartSession>
  prepareVideoRecognition: (key: string) => Promise<RecognitionCaptureSession>
  getVideoFilePath: (file: File) => string
  startVideoFileRecognition: (key: string, filePath: string) => Promise<BootstrapState>
  checkRecognitionTarget: () => Promise<RecognitionTargetHealth>
  submitRecognitionFrame: (payload: RecognitionFramePayload) => Promise<BootstrapState>
  stopRecognition: () => Promise<BootstrapState>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: XingPartyAPI
  }
}
