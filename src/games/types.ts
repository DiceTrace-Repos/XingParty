import type {
  RecognitionFramePayload,
  RecognitionProfile,
  SceneType,
  PhaseType,
  DiceSide,
  LuckyPartyRecognitionResult
} from '../shared/types'

export interface GameRecognitionResult {
  scene: SceneType
  phase: PhaseType
  side?: DiceSide
  confidence: number
  value?: number
  structured?: LuckyPartyRecognitionResult
}

export interface GameAdapter {
  readonly key: string
  readonly id: string
  readonly nameKey: string
  readonly profile: RecognitionProfile
  recognize(frame: RecognitionFramePayload): GameRecognitionResult | undefined
}
