import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { createPlatformAdapter } from './platform-adapters'

type FrameHandler = (jpeg: Buffer) => void

export class VideoFrameExtractor {
  private process?: ChildProcessWithoutNullStreams
  private pending = Buffer.alloc(0)

  start(filePath: string, intervalMs: number, onFrame: FrameHandler, onEnd?: () => void): void {
    this.stop()
    const ffmpegPath = resolveFfmpegPath()
    const fps = (1000 / intervalMs).toFixed(6)
    this.process = spawn(ffmpegPath, [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      filePath,
      '-vf',
      `fps=${fps}`,
      '-an',
      '-f',
      'image2pipe',
      '-vcodec',
      'mjpeg',
      '-q:v',
      '3',
      'pipe:1'
    ])

    this.process.stdout.on('data', (chunk: Buffer) => {
      this.pending = Buffer.concat([this.pending, chunk])
      this.drainFrames(onFrame)
    })
    this.process.on('error', () => this.stop())
    this.process.on('close', () => {
      this.process = undefined
      this.pending = Buffer.alloc(0)
      onEnd?.()
    })
  }

  stop(): void {
    if (this.process) {
      this.process.kill()
      this.process = undefined
    }
    this.pending = Buffer.alloc(0)
  }

  private drainFrames(onFrame: FrameHandler): void {
    while (true) {
      const start = this.pending.indexOf(Buffer.from([0xff, 0xd8]))
      if (start < 0) {
        this.pending = Buffer.alloc(0)
        return
      }

      const end = this.pending.indexOf(Buffer.from([0xff, 0xd9]), start + 2)
      if (end < 0) {
        this.pending = this.pending.subarray(start)
        return
      }

      onFrame(this.pending.subarray(start, end + 2))
      this.pending = this.pending.subarray(end + 2)
    }
  }
}

function resolveFfmpegPath(): string {
  const configuredPath = process.env['XINGPARTY_FFMPEG_PATH']
  if (configuredPath) {
    return configuredPath
  }

  const executableName = createPlatformAdapter().ffmpegExecutableName
  const bundledPath = join(process.resourcesPath, 'resources', 'ffmpeg', executableName)
  if (!existsSync(bundledPath)) {
    if (process.env['NODE_ENV'] !== 'production' && process.env['ELECTRON_RENDERER_URL']) {
      return executableName
    }
    throw new Error('安装包缺少内置 FFmpeg，请重新安装完整版本的 XingParty')
  }

  return bundledPath
}
