export type Locale = 'zh-CN' | 'en-US'
export type PlatformName = NodeJS.Platform

export type SceneType = 'map' | 'battle' | 'unknown'
export type PhaseType = 'move' | 'attack' | 'defense' | 'unknown'
export type DiceSide = 'self' | 'enemy'
export type DiceStepSource = 'base' | 'card_bonus' | 'manual' | 'unknown'
export type DetectionSource = 'vision' | 'manual' | 'unknown'

export interface GameCatalogItem {
  id: string
  key: string
}

export interface StoredGame extends GameCatalogItem {
  cachedAt: string
}

export interface ClientState {
  clientId: string
  locale: Locale
  activeGameKey?: string
  createdAt: string
  updatedAt: string
}

export interface PlaySession {
  id: string
  gameId: string
  gameKey: string
  startedAt: string
  endedAt?: string
  status: 'active' | 'completed'
}

export interface Round {
  id: string
  sessionId: string
  gameId: string
  gameKey: string
  roundIndex: number
  remoteControlUsed: boolean
  remoteControlDetectedBy: DetectionSource
  startedAt: string
  endedAt?: string
}

export interface DiceEvent {
  id: string
  gameId: string
  gameKey: string
  sessionId?: string
  roundId?: string
  scene: SceneType
  phase: PhaseType
  side?: DiceSide
  confidence: number
  capturedAt: string
  createdAt: string
  correctedAt?: string
}

export interface DiceValueStep {
  id: string
  eventId: string
  sequenceIndex: number
  sourceType: DiceStepSource
  baseValue?: number
  previousValue?: number
  deltaValue?: number
  finalValue: number
  cardIndex?: number
  confidence: number
}

export interface RecentDiceEvent extends DiceEvent {
  finalValue: number
  stepCount: number
}

export interface BootstrapState {
  client: ClientState
  games: StoredGame[]
  activeGame?: StoredGame
  recentEvents: RecentDiceEvent[]
  recognitionRunning: boolean
}

export type AppLogLevel = 'info' | 'warn' | 'error'

export interface AppLogEntry {
  id: string
  level: AppLogLevel
  scope: string
  message: string
  detail?: string
  createdAt: string
}

export interface RecognitionRoi {
  xRatio: number
  yRatio: number
  widthRatio: number
  heightRatio: number
}

export interface RecognitionProfile {
  gameKey: string
  exePaths: Partial<Record<PlatformName, string>>
  captureIntervalMs: number
  stableFrameCount: number
  rois: {
    dice: RecognitionRoi
  }
}

export interface GameWindowCandidate {
  hwnd: string
  pid: number
  title: string
  exePath: string
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface RecognitionCaptureTarget {
  gameKey: string
  sourceId: string
  sourceName: string
  window: GameWindowCandidate
  profile: RecognitionProfile
}

export interface RecognitionFramePayload {
  gameKey: string
  capturedAt: string
  imageDataUrl: string
  width: number
  height: number
}

export interface RecognitionStatus {
  running: boolean
  activeGameKey?: string
}

export interface RecognitionTargetHealth {
  alive: boolean
  state: BootstrapState
}
