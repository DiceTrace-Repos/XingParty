import type { PlatformAdapter } from '../types'
import { WindowsWindowMatcher } from '../../window-matcher/windows'
import { createSafeStorageFileAdapter } from '../safe-storage-file'

export function createWindowsPlatformAdapter(): PlatformAdapter {
  return {
    platform: 'win32',
    secretStorage: createSafeStorageFileAdapter('Windows 安全凭据存储不可用'),
    windowMatcher: new WindowsWindowMatcher(),
    ffmpegExecutableName: 'ffmpeg.exe',
    getDefaultGamePath: (profile) => profile.exePaths.win32 ?? ''
  }
}
