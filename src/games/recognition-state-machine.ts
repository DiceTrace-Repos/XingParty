import type { GameRecognitionResult } from './types'
import type { RecognitionFrame } from './raw-model-output-parser'

export interface RecognitionState {
  currentRoundNumber: number | null
  actionType: RecognitionFrame['scene'] | null
  missedLabelFrameCount: number
  gameEnded: boolean
}

export class LuckyPartyRecognitionStateMachine {
  private currentRoundNumber: number | null = null
  private actionType: RecognitionFrame['scene'] | null = null
  private pending?: GameRecognitionResult
  private missedLabelFrameCount = 0
  private gameEnded = false

  process(result: GameRecognitionResult): GameRecognitionResult | undefined {
    const frame = result.intermediate
    if (!frame || this.gameEnded) {
      return undefined
    }

    this.missedLabelFrameCount = 0
    const nextRound = frame.roundNumber ?? this.currentRoundNumber
    const actionChanged = this.actionType !== null && this.actionType !== frame.scene
    const roundChanged =
      this.currentRoundNumber !== null &&
      nextRound !== null &&
      this.currentRoundNumber !== nextRound

    this.currentRoundNumber = nextRound
    this.actionType = frame.scene

    if (actionChanged || roundChanged) {
      const completed = this.pending
      this.pending = result
      return completed
    }

    this.pending = result
    return undefined
  }

  processNoLabelFrame(): void {
    if (this.gameEnded) {
      return
    }

    this.missedLabelFrameCount += 1
    if (this.missedLabelFrameCount >= 10) {
      this.gameEnded = true
    }
  }

  flush(): GameRecognitionResult | undefined {
    const completed = this.pending
    this.pending = undefined
    return completed
  }

  getState(): RecognitionState {
    return {
      currentRoundNumber: this.currentRoundNumber,
      actionType: this.actionType,
      missedLabelFrameCount: this.missedLabelFrameCount,
      gameEnded: this.gameEnded
    }
  }
}
