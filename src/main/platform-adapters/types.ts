import type { RecognitionProfile } from '../../shared/types'
import type { GameWindowMatcher } from '../window-matcher/types'

export interface SecretStorageAdapter {
  get(key: string): string | undefined
  set(key: string, value: string): void
}

export interface PlatformAdapter {
  platform: NodeJS.Platform
  secretStorage: SecretStorageAdapter
  windowMatcher: GameWindowMatcher
  ffmpegExecutableName: string
  getDefaultGamePath(profile: RecognitionProfile): string
}
