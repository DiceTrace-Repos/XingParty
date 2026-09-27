import type { GameWindowCandidate, PlatformName } from '../../shared/types'

export interface GameWindowMatcher {
  findSingleWindowByExePath(exePath: string): Promise<GameWindowCandidate>
}

export class GameWindowLookupError extends Error {
  constructor(
    readonly code:
      | 'WINDOW_LOOKUP_UNSUPPORTED'
      | 'GAME_WINDOW_NOT_FOUND'
      | 'MULTIPLE_GAME_WINDOWS'
      | 'WINDOW_LOOKUP_FAILED',
    message: string
  ) {
    super(message)
  }
}

export function createUnsupportedWindowMatcher(platform: PlatformName): GameWindowMatcher {
  return {
    async findSingleWindowByExePath(): Promise<GameWindowCandidate> {
      throw new GameWindowLookupError(
        'WINDOW_LOOKUP_UNSUPPORTED',
        `当前平台暂未实现窗口识别：${platform}`
      )
    }
  }
}
