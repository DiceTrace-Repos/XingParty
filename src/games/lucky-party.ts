import type { RecognitionProfile } from '../shared/types'
import type { GameRecognitionResult } from './types'

export const luckyPartyProfile: RecognitionProfile = {
  gameKey: 'lucky-party',
  exePaths: {
    win32: 'G:\\Steam\\steamapps\\common\\Astral Party\\8vJXn6CN\\AstralParty_CN.exe'
  },
  captureIntervalMs: 1200,
  stableFrameCount: 1,
  rois: {
    dice: { xRatio: 0.42, yRatio: 0.38, widthRatio: 0.16, heightRatio: 0.16 }
  }
}

export function recognizeLuckyPartyFrame(): GameRecognitionResult | undefined {
  return undefined
}

export const luckyPartyGame = {
  id: 'game_001',
  key: 'lucky-party',
  nameKey: 'games.luckyParty.name',
  profile: luckyPartyProfile
}
