import { createUnsupportedPlatformAdapter } from './unsupported'
import type { PlatformAdapter } from './types'
import { createMacosPlatformAdapter } from './macos'
import { createWindowsPlatformAdapter } from './windows'

export function createPlatformAdapter(
  platform: NodeJS.Platform = process.platform
): PlatformAdapter {
  switch (platform) {
    case 'win32':
      return createWindowsPlatformAdapter()
    case 'darwin':
      return createMacosPlatformAdapter()
    default:
      return createUnsupportedPlatformAdapter(platform)
  }
}
