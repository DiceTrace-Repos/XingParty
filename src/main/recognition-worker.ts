import { app } from 'electron'
import { randomUUID } from 'crypto'
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { LocalStore } from './local-store'
import { recognizeLuckyPartyFrame } from '../games/lucky-party'
import { appLogger } from './app-logger'
import { loadMockRecognitionFixture } from './mock-recognition-source'
import { parseRawModelFrame } from '../games/raw-model-output-parser'
import { LuckyPartyRecognitionStateMachine } from '../games/recognition-state-machine'
import type { GameRecognitionResult } from '../games/types'
import type {
  DiceEvent,
  RecognitionCaptureTarget,
  RecognitionFramePayload,
  RecognitionStatus
} from '../shared/types'
import type { DiceEventUploadService } from './dice-event-upload-service'

export class RecognitionWorker {
  private timer?: NodeJS.Timeout
  private activeGameKey?: string
  private frameCount = 0
  private lastAcceptedAt = 0
  private captureTarget?: RecognitionCaptureTarget
  private pendingUploadEvents: DiceEvent[] = []

  constructor(
    private readonly store: LocalStore,
    private readonly uploadService?: DiceEventUploadService
  ) {}

  private persistRecognitionResult(gameKey: string, result: GameRecognitionResult): void {
    const events = this.store.appendRecognitionEvent(gameKey, result)
    this.pendingUploadEvents.push(...events)
  }

  private persistMockEvent(gameKey: string): void {
    const events = this.store.appendMockRecognitionEvent(gameKey)
    this.pendingUploadEvents.push(...events)
  }

  private uploadPendingEvents(): void {
    const events = this.pendingUploadEvents
    this.pendingUploadEvents = []
    if (this.uploadService && events.length > 0) void this.uploadService.upload(events)
  }

  startMock(gameKey: string): RecognitionStatus {
    this.stop()
    const fixture = loadMockRecognitionFixture()
    this.activeGameKey = gameKey
    let frameIndex = 0
    let stateMachine = new LuckyPartyRecognitionStateMachine()
    this.store.beginRecognitionSession(gameKey)

    const submitNextFrame = (): void => {
      try {
        const frame = fixture.frames[frameIndex]
        if (!frame || this.activeGameKey !== gameKey) {
          return
        }

        if (frame.predictions.length === 0) {
          stateMachine.processNoLabelFrame()
          if (stateMachine.getState().gameEnded) {
            const finalResult = stateMachine.flush()
            if (finalResult) {
              this.persistRecognitionResult(gameKey, finalResult)
            }
            this.store.completeActiveSession(gameKey)
            this.uploadPendingEvents()
            stateMachine = new LuckyPartyRecognitionStateMachine()
            appLogger.info('recognition', '检测到一局结束，已刷新骰子统计', { gameKey })
          }
        }
        const result = parseRawModelFrame(frame, new Date().toISOString())
        const completed = result ? stateMachine.process(result) : undefined
        if (completed) {
          this.persistRecognitionResult(gameKey, completed)
        }
        appLogger.info('recognition', `已处理模拟模型输出帧 ${frame.frameId}`, frame.predictions)

        frameIndex = (frameIndex + 1) % fixture.frames.length
        if (frameIndex === 0) {
          appLogger.info('recognition', '模拟模型输出已播放完毕，重新从第一帧开始', {
            gameKey,
            frameCount: fixture.frames.length
          })
        }
      } catch (error) {
        appLogger.error('recognition', '识别过程发生异常，正在结束监听', error)
        this.stop()
      }
    }

    submitNextFrame()

    this.timer = setInterval(submitNextFrame, 1500)

    return this.getStatus()
  }

  startCapture(target: RecognitionCaptureTarget): RecognitionStatus {
    this.stop()
    this.activeGameKey = target.gameKey
    this.captureTarget = target
    this.frameCount = 0
    this.lastAcceptedAt = 0
    this.store.beginRecognitionSession(target.gameKey)

    return this.getStatus()
  }

  submitFrame(payload: RecognitionFramePayload): RecognitionStatus {
    if (!this.captureTarget || this.activeGameKey !== payload.gameKey) {
      return this.getStatus()
    }

    try {
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
        const result = payload.gameKey === 'lucky-party' ? recognizeLuckyPartyFrame() : undefined
        if (result) {
          this.persistRecognitionResult(payload.gameKey, result)
        } else {
          this.persistMockEvent(payload.gameKey)
          appLogger.info('recognition', '本地模型尚未接入，已写入模拟识别结果', {
            gameKey: payload.gameKey,
            screenshotPath
          })
        }
        this.lastAcceptedAt = now
      }

      return this.getStatus()
    } catch (error) {
      appLogger.error('recognition', '识别过程发生异常，正在结束监听', error)
      this.stop()
      throw error
    }
  }

  stop(): RecognitionStatus {
    const stoppedGameKey = this.activeGameKey
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = undefined
    }

    this.activeGameKey = undefined
    this.captureTarget = undefined
    this.frameCount = 0
    this.lastAcceptedAt = 0
    if (stoppedGameKey) {
      this.store.completeActiveSession(stoppedGameKey)
    }
    this.uploadPendingEvents()
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
