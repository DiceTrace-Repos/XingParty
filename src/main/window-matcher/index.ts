import type { PlatformName } from '../../shared/types'
import { createUnsupportedWindowMatcher, type GameWindowMatcher } from './types'
import { WindowsWindowMatcher } from './windows'

export { GameWindowLookupError } from './types'

export function createWindowMatcher(platform: PlatformName = process.platform): GameWindowMatcher {
  switch (platform) {
    case 'win32':
      return new WindowsWindowMatcher()
    case 'darwin':
    case 'linux':
    default:
      return createUnsupportedWindowMatcher(platform)
  }
}
