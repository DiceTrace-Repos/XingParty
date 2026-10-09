export type Locale = 'zh-CN' | 'en-US'
export type PlatformName = NodeJS.Platform

export type SceneType = 'map' | 'battle' | 'unknown'
export type DiceStepSource = 'base' | 'card_bonus' | 'manual' | 'unknown'
export type DetectionSource = 'vision' | 'manual' | 'unknown'
export type DiceEventSourceType = 'raw' | 'card' | 'map'

export interface GameCatalogItem {
  id: string
  key: string
}

export interface StoredGame extends GameCatalogItem {
  cachedAt: string
}

export interface GameRoleResourceItem {
  game_id: string | null
  avatar: string | null
  name: string
}

export interface GameRoleResourceSnapshot {
  version: string
  contents: GameRoleResourceItem[]
  updatedAt: string
}

export interface ClientState {
  clientId: string
  locale: Locale
  activeGameKey?: string
  gamePath: string
  autoShareData: boolean
  createdAt: string
  updatedAt: string
}

export interface ClientSettingsUpdate {
  gamePath?: string
  autoShareData?: boolean
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
  value: number
  from: FromSchema
  createdAt: string
  correctedInfo?: {
    originValue: DiceEvent
    newValue: DiceEvent
    correctedAt: string
  }[]
}

export interface FromSchema {
  type: DiceEventSourceType
  userDevice: string
  sessionId: string
  roundId: string
  gameRole: string
  cardInfo?: {
    type: 'attack' | 'defence'
    cost: number
  }
  frameInfo: string
  intermediateData: string
}

export interface RecentDiceEvent extends DiceEvent {
  id: string
  gameKey: string
}

export interface DiceStatisticsSession {
  id: string
  startedAt: string
  endedAt?: string
}

export interface DiceStatisticsRound {
  id: string
  sessionId: string
  roundIndex: number
}

export interface DiceStatisticsEntry {
  sessionId: string
  roundId: string
  gameRole: string
  type: DiceEventSourceType
  value: number
  count: number
}

export interface DiceStatistics {
  sessions: DiceStatisticsSession[]
  rounds: DiceStatisticsRound[]
  entries: DiceStatisticsEntry[]
}

export interface BootstrapState {
  client: ClientState
  games: StoredGame[]
  activeGame?: StoredGame
  gameRoleResource?: GameRoleResourceSnapshot
  recentEvents: RecentDiceEvent[]
  diceStatistics?: DiceStatistics
  latestRecognition?: RecognitionRecord
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

export interface LuckyPartyPlayerInfo {
  headCount: number | null
  characterCode: string | null
  cardDiceValues: Array<number | null>
  cardPointValues: Array<number | null>
}

export interface LuckyPartyRecognitionResult {
  schemaVersion: 2
  capturedAt: string
  roundInfo: Array<number | null>
  diceValues: Array<number | null>
  characterCode: string | null
  players: [LuckyPartyPlayerInfo, LuckyPartyPlayerInfo]
}

export interface RecognitionRecord {
  id: string
  gameId: string
  gameKey: string
  capturedAt: string
  scene: SceneType
  value?: number
  structured: LuckyPartyRecognitionResult
  originData: string
}

export interface RecognitionTargetHealth {
  alive: boolean
  state: BootstrapState
}
