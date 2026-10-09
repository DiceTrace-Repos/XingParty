import type { SceneType, LuckyPartyRecognitionResult } from '../shared/types'
import type { RecognitionFrame } from './raw-model-output-parser'

export interface GameRecognitionResult {
  scene: SceneType
  value?: number
  structured?: LuckyPartyRecognitionResult
  originData: string
  intermediate?: RecognitionFrame
}
