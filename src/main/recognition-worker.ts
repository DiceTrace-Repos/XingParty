import { app } from 'electron'
import { randomUUID } from 'crypto'
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { LocalStore } from './local-store'
import { getGameAdapter } from '../games/registry'
import { appLogger } from './app-logger'
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

    const screenshotPath = this.saveScreenshot(payload)
    appLogger.info('capture', '识别截图已保存', {
      gameKey: payload.gameKey,
      capturedAt: payload.capturedAt,
      width: payload.width,
      height: payload.height,
      screenshotPath,
      frameCount: this.frameCount
    })

    const now = Date.now()
    const intervalElapsed =
      now - this.lastAcceptedAt >= this.captureTarget.profile.captureIntervalMs

    if (intervalElapsed) {
      const result = getGameAdapter(payload.gameKey)?.recognize(payload)
      if (result) {
        this.store.appendRecognitionEvent(payload.gameKey, result)
      } else {
        this.store.appendMockRecognitionEvent(payload.gameKey)
        appLogger.info('recognition', '本地模型尚未接入，已写入模拟识别结果', {
          gameKey: payload.gameKey,
          screenshotPath
        })
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

  submitVideoFrame(gameKey: string, jpeg: Buffer): RecognitionStatus {
    return this.submitFrame({
      gameKey,
      capturedAt: new Date().toISOString(),
      imageDataUrl: `data:image/jpeg;base64,${jpeg.toString('base64')}`,
      width: 0,
      height: 0
    })
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

  private saveScreenshot(payload: RecognitionFramePayload): string {
    const screenshotDirectory = join(app.getPath('userData'), 'logs', 'screenshots')
    mkdirSync(screenshotDirectory, { recursive: true })

    const imageData = payload.imageDataUrl.match(/^data:image\/(jpeg|jpg|png);base64,(.+)$/s)
    if (!imageData) {
      throw new Error('截图数据格式无效，仅支持 JPEG 或 PNG Data URL')
    }

    const extension = imageData[1] === 'png' ? 'png' : 'jpg'
    const filename = `${payload.gameKey}-${payload.capturedAt.replace(/[:.]/g, '-')}-${randomUUID()}.${extension}`
    const screenshotPath = join(screenshotDirectory, filename)
    writeFileSync(screenshotPath, Buffer.from(imageData[2], 'base64'))
    this.pruneScreenshots(screenshotDirectory)
    return screenshotPath
  }

  private pruneScreenshots(screenshotDirectory: string): void {
    const screenshotFiles = readdirSync(screenshotDirectory)
      .filter((file) => file.endsWith('.jpg') || file.endsWith('.png'))
      .sort()

    for (const file of screenshotFiles.slice(0, -300)) {
      unlinkSync(join(screenshotDirectory, file))
    }
  }
}
