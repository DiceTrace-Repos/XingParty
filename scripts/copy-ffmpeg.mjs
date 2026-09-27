import { chmodSync, copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ffmpegPath from 'ffmpeg-static'

if (!ffmpegPath) {
  throw new Error('当前平台没有可用的 ffmpeg-static 二进制')
}

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const executableName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
const destination = join(projectRoot, 'resources', 'ffmpeg', executableName)

mkdirSync(dirname(destination), { recursive: true })
copyFileSync(ffmpegPath, destination)

if (process.platform !== 'win32') {
  chmodSync(destination, 0o755)
}

console.log(`Bundled FFmpeg: ${destination}`)
