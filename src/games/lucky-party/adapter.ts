import type { GameAdapter } from '../types'
import type { LuckyPartyRecognitionResult } from '../../shared/types'

const emptyPlayer = (): LuckyPartyRecognitionResult['players'][number] => ({
  headCount: null,
  characterCode: null,
  characterType: 'unknown',
  name: null,
  cardDiceValues: [],
  cardPointValues: [],
  confidence: {
    headCount: 0,
    characterCode: 0,
    name: 0,
    cardDiceValues: 0,
    cardPointValues: 0
  }
})

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
    stableFrameCount: 1,
    rois: {
      dice: { xRatio: 0.42, yRatio: 0.38, widthRatio: 0.16, heightRatio: 0.16 }
    }
  },
  recognize(frame) {
    const result: LuckyPartyRecognitionResult = {
      schemaVersion: 1,
      capturedAt: frame.capturedAt,
      roundInfo: [],
      diceValues: [],
      characterCode: null,
      players: [emptyPlayer(), emptyPlayer()],
      confidence: {
        roundInfo: 0,
        diceValues: 0,
        characterCode: 0,
        players: [0, 0]
      }
    }

    return {
      scene: 'unknown',
      phase: 'unknown',
      confidence: 0,
      structured: result
    }
  }
}
