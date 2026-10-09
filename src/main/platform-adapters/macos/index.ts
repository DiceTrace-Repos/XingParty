import type { PlatformAdapter } from '../types'
import { createUnsupportedWindowMatcher } from '../../window-matcher/types'
import { createSafeStorageFileAdapter } from '../safe-storage-file'

export function createMacosPlatformAdapter(): PlatformAdapter {
  return {
    platform: 'darwin',
    secretStorage: createSafeStorageFileAdapter('macOS Keychain 安全凭据存储不可用'),
    windowMatcher: createUnsupportedWindowMatcher('darwin'),
    ffmpegExecutableName: 'ffmpeg',
    getDefaultGamePath: (profile) => profile.exePaths.darwin ?? ''
  }
}
