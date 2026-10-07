import type { GameRecognitionResult } from '../types'
import type { RawModelFrame, RawPrediction } from '../../shared/raw-model-output'
import type { LuckyPartyPlayerInfo } from '../../shared/types'

type ScreenSide = 'left' | 'right'

const MAP_LABELS = new Set<RawPrediction['label']>(['board_die', 'round_slot', 'map_character'])
const BATTLE_LABELS = new Set<RawPrediction['label']>([
  'player_head_count',
  'battle_character',
  'card_dice_value',
  'card_point_value'
])

const emptyPlayer = (): LuckyPartyPlayerInfo => ({
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

function predictions(frame: RawModelFrame, label: RawPrediction['label']): RawPrediction[] {
  return frame.predictions.filter((prediction) => prediction.label === label)
}

function attribute(
  prediction: RawPrediction | undefined,
  key: string
): string | number | undefined {
  return prediction?.attributes[key]
}

function parseNullableNumber(value: string | number | undefined): number | null {
  if (value === undefined || value === 'null') {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function indexedValues(items: RawPrediction[]): Array<number | null> {
  return [...items]
    .sort((left, right) => Number(attribute(left, 'index')) - Number(attribute(right, 'index')))
    .map((item) => parseNullableNumber(attribute(item, 'value')))
}

function meanConfidence(items: RawPrediction[]): number {
  if (items.length === 0) {
    return 0
  }

  return Number(
    (items.reduce((total, prediction) => total + prediction.confidence, 0) / items.length).toFixed(
      4
    )
  )
}

function inferScene(frame: RawModelFrame): GameRecognitionResult['scene'] {
  const score = (labels: Set<RawPrediction['label']>): number =>
    frame.predictions.reduce(
      (total, prediction) => total + (labels.has(prediction.label) ? prediction.confidence : 0),
      0
    )
  const mapScore = score(MAP_LABELS)
  const battleScore = score(BATTLE_LABELS)

  if (mapScore === 0 && battleScore === 0) {
    return 'unknown'
  }
  return battleScore > mapScore ? 'battle' : 'map'
}

function sidePredictions(
  frame: RawModelFrame,
  label: RawPrediction['label'],
  side: ScreenSide
): RawPrediction[] {
  return predictions(frame, label).filter((item) => attribute(item, 'side') === side)
}

function classifyCharacter(characterCode: string | null): LuckyPartyPlayerInfo['characterType'] {
  const gameId = Number(characterCode)
  if (Number.isInteger(gameId) && gameId < 1000) {
    return 'role'
  }
  if (Number.isInteger(gameId) && gameId > 1000) {
    return 'monster'
  }
  return 'unknown'
}

function parsePlayer(frame: RawModelFrame, side: ScreenSide): LuckyPartyPlayerInfo {
  const character = sidePredictions(frame, 'battle_character', side)[0]
  const headCount = sidePredictions(frame, 'player_head_count', side)[0]
  const dice = sidePredictions(frame, 'card_dice_value', side)
  const points = sidePredictions(frame, 'card_point_value', side)
  const rawCharacterCode = attribute(character, 'value')
  const characterCode = rawCharacterCode === undefined ? null : String(rawCharacterCode)

  return {
    ...emptyPlayer(),
    headCount: parseNullableNumber(attribute(headCount, 'value')),
    characterCode,
    characterType: classifyCharacter(characterCode),
    cardDiceValues: indexedValues(dice),
    cardPointValues: indexedValues(points),
    confidence: {
      headCount: headCount?.confidence ?? 0,
      characterCode: character?.confidence ?? 0,
      name: 0,
      cardDiceValues: meanConfidence(dice),
      cardPointValues: meanConfidence(points)
    }
  }
}

function lastRecognizedValue(values: Array<number | null>): number | undefined {
  return [...values].reverse().find((value): value is number => value !== null)
}

export function parseRawModelFrame(
  frame: RawModelFrame,
  capturedAt = frame.capturedAt
): GameRecognitionResult {
  const roundSlots = predictions(frame, 'round_slot')
  const boardDice = predictions(frame, 'board_die')
  const mapCharacter = predictions(frame, 'map_character')[0]
  const scene = inferScene(frame)
  const isBattle = scene === 'battle'
  const players: [LuckyPartyPlayerInfo, LuckyPartyPlayerInfo] = isBattle
    ? [parsePlayer(frame, 'left'), parsePlayer(frame, 'right')]
    : [emptyPlayer(), emptyPlayer()]
  const roundInfo = indexedValues(roundSlots)
  const diceValues = indexedValues(boardDice)
  const characterCode = mapCharacter ? String(attribute(mapCharacter, 'value') ?? '') || null : null
  const roleIndex = players.findIndex((player) => player.characterType === 'role')
  const role = roleIndex >= 0 ? players[roleIndex] : undefined
  const overallConfidence = meanConfidence(frame.predictions)

  return {
    scene,
    phase: scene === 'map' ? 'move' : 'unknown',
    side: isBattle && role ? 'self' : undefined,
    confidence: overallConfidence,
    value:
      scene === 'battle'
        ? lastRecognizedValue(role?.cardDiceValues ?? [])
        : scene === 'map'
          ? lastRecognizedValue(diceValues)
          : undefined,
    structured: {
      schemaVersion: 1,
      capturedAt,
      roundInfo,
      diceValues,
      characterCode,
      players,
      confidence: {
        roundInfo: meanConfidence(roundSlots),
        diceValues: meanConfidence(boardDice),
        characterCode: mapCharacter?.confidence ?? 0,
        players: [
          meanConfidence(frame.predictions.filter((item) => attribute(item, 'side') === 'left')),
          meanConfidence(frame.predictions.filter((item) => attribute(item, 'side') === 'right'))
        ]
      }
    }
  }
}
