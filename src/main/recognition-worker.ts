import type { LocalStore } from './local-store'
import { getGameAdapter } from '../games/registry'
import type {
  RecognitionCaptureTarget,
  RecognitionFramePayload,
  RecognitionStatus
} from '../shared/types'

export class RecognitionWorker {
  private timer?: NodeJS.Timeout
  private activeGameKey?: string
  private frameCount = 0
  private lastAcceptedAt = 0
  private captureTarget?: RecognitionCaptureTarget

  constructor(private readonly store: LocalStore) {}

  startMock(gameKey: string): RecognitionStatus {
    this.stop()
    this.activeGameKey = gameKey
    this.store.appendMockRecognitionEvent(gameKey)

    this.timer = setInterval(() => {
      if (this.activeGameKey) {
        this.store.appendMockRecognitionEvent(this.activeGameKey)
      }
    }, 3500)

    return this.getStatus()
  }

  startCapture(target: RecognitionCaptureTarget): RecognitionStatus {
    this.stop()
    this.activeGameKey = target.gameKey
    this.captureTarget = target
    this.frameCount = 0
    this.lastAcceptedAt = 0

    return this.getStatus()
  }

  submitFrame(payload: RecognitionFramePayload): RecognitionStatus {
    if (!this.captureTarget || this.activeGameKey !== payload.gameKey) {
      return this.getStatus()
    }

    this.frameCount += 1

    const now = Date.now()
    const stableEnough = this.frameCount % this.captureTarget.profile.stableFrameCount === 0
    const intervalElapsed =
      now - this.lastAcceptedAt >= this.captureTarget.profile.captureIntervalMs

    if (stableEnough && intervalElapsed) {
      const result = getGameAdapter(payload.gameKey)?.recognize(payload)
      if (result) {
        this.store.appendRecognitionEvent(payload.gameKey, result)
      } else {
        this.store.appendMockRecognitionEvent(payload.gameKey)
      }
      this.lastAcceptedAt = now
    }

    return this.getStatus()
  }

  stop(): RecognitionStatus {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = undefined
    }

    this.activeGameKey = undefined
    this.captureTarget = undefined
    this.frameCount = 0
    this.lastAcceptedAt = 0
    return this.getStatus()
  }

  getStatus(): RecognitionStatus {
    return {
      running: Boolean(this.timer || this.captureTarget),
      activeGameKey: this.activeGameKey
    }
  }

  getCaptureTarget(): RecognitionCaptureTarget | undefined {
    return this.captureTarget
  }
}
