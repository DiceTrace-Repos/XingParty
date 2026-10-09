import type { PlatformAdapter } from './types'
import { createUnsupportedWindowMatcher } from '../window-matcher/types'

export function createUnsupportedPlatformAdapter(platform: NodeJS.Platform): PlatformAdapter {
  const unsupported = (): never => {
    throw new Error(`当前平台暂未实现安全凭据存储：${platform}`)
  }
  return {
    platform,
    secretStorage: { get: unsupported, set: unsupported },
    windowMatcher: createUnsupportedWindowMatcher(platform),
    get ffmpegExecutableName(): string {
      return unsupported()
    },
    getDefaultGamePath: unsupported
  }
}
