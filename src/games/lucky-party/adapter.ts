import type { GameAdapter } from '../types'

export const luckyPartyAdapter: GameAdapter = {
  key: 'lucky-party',
  id: 'game_001',
  nameKey: 'games.luckyParty.name',
  profile: {
    gameKey: 'lucky-party',
    exePaths: {
      win32: 'G:\\Steam\\steamapps\\common\\Astral Party\\8vJXn6CN\\AstralParty_CN.exe'
    },
    captureIntervalMs: 1200,
    stableFrameCount: 3,
    rois: {
      dice: { xRatio: 0.42, yRatio: 0.38, widthRatio: 0.16, heightRatio: 0.16 }
    }
  },
  recognize() {
    return undefined
  }
}
