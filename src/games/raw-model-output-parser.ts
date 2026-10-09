import type { GameRecognitionResult } from './types'
import type { RawModelFrame, RawPrediction } from '../shared/raw-model-output'
import type { LuckyPartyPlayerInfo, LuckyPartyRecognitionResult } from '../shared/types'

type ScreenSide = 'left' | 'right'
export type RecognitionScene = 'map' | 'battle'

const MAP_LABELS = new Set<RawPrediction['label']>(['board_die', 'round_slot', 'map_character'])
const BATTLE_LABELS = new Set<RawPrediction['label']>([
  'player_head_count',
  'battle_character',
  'card_dice_value',
  'card_point_value'
])
const THRESHOLDS: Record<RawPrediction['label'], number> = {
  board_die: 0.8,
  round_slot: 0.8,
  player_head_count: 0.8,
  map_character: 0.8,
  battle_character: 0.8,
  card_dice_value: 0.8,
  card_point_value: 0.8
}

export interface MapRecognitionData {
  scene: 'map'
  roundSlots: Array<number | null>
  boardDice: Array<number | null>
  gameRole: string
  roundNumber: number | null
}

export interface BattlePlayerRecognition {
  gameRole: string
  headCount: number | null
  cardDiceValues: Array<number | null>
  cardPointValues: Array<number | null>
}

export interface BattleRecognitionData {
  scene: 'battle'
  players: [BattlePlayerRecognition, BattlePlayerRecognition]
}

export interface RecognitionFrame {
  frameId: string
  frameNumber: number
  capturedAt: string
  originData: string
  scene: RecognitionScene
  roundNumber: number | null
  data: MapRecognitionData | BattleRecognitionData
}

function valueOf(prediction: RawPrediction, key: string): string | number | undefined {
  return prediction.attributes[key]
}

function asNumber(value: string | number | undefined): number | null {
  if (value === undefined || value === 'null') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function asRequiredString(value: string | number | undefined): string | null {
  if (value === undefined || String(value).trim() === '') return null
  return String(value)
}

function sideOf(prediction: RawPrediction): ScreenSide | null {
  const side = valueOf(prediction, 'side')
  return side === 'left' || side === 'right' ? side : null
}

function indexOf(prediction: RawPrediction): number | null {
  const value = Number(valueOf(prediction, 'index'))
  return Number.isInteger(value) && value >= 0 ? value : null
}

function predictions(frame: RawModelFrame, label: RawPrediction['label']): RawPrediction[] {
  return frame.predictions.filter((prediction) => prediction.label === label)
}

function hasDuplicateIndex(items: RawPrediction[], includeSide = false): boolean {
  const keys = new Set<string>()
  for (const item of items) {
    const index = indexOf(item)
    const side = includeSide ? sideOf(item) : ''
    const key = `${side}:${index}`
    if (keys.has(key)) return true
    keys.add(key)
  }
  return false
}

function validatePrediction(prediction: RawPrediction): boolean {
  if (
    !Number.isFinite(prediction.confidence) ||
    prediction.confidence < THRESHOLDS[prediction.label]
  ) {
    return false
  }
  if (
    prediction.bbox.length !== 4 ||
    prediction.bbox.some((coordinate) => !Number.isFinite(coordinate))
  ) {
    return false
  }

  switch (prediction.label) {
    case 'board_die':
      return (
        indexOf(prediction) !== null &&
        (asNumber(valueOf(prediction, 'value')) !== null || valueOf(prediction, 'value') === 'null')
      )
    case 'round_slot': {
      const index = indexOf(prediction)
      const value = valueOf(prediction, 'value')
      const numeric = asNumber(value)
      return (
        index !== null &&
        (value === 'null' || numeric === -1 || (numeric !== null && numeric >= 1 && numeric <= 20))
      )
    }
    case 'map_character':
      return asRequiredString(valueOf(prediction, 'value')) !== null
    case 'battle_character':
      return sideOf(prediction) !== null && asRequiredString(valueOf(prediction, 'value')) !== null
    case 'player_head_count':
      return (
        sideOf(prediction) !== null &&
        (asNumber(valueOf(prediction, 'value')) !== null || valueOf(prediction, 'value') === 'null')
      )
    case 'card_dice_value':
      return (
        sideOf(prediction) !== null &&
        indexOf(prediction) !== null &&
        asNumber(valueOf(prediction, 'value')) !== null
      )
    case 'card_point_value': {
      const numeric = asNumber(valueOf(prediction, 'value'))
      return (
        sideOf(prediction) !== null &&
        indexOf(prediction) !== null &&
        (valueOf(prediction, 'value') === 'null' ||
          (numeric !== null && numeric >= 1 && numeric <= 10))
      )
    }
  }
}

function indexedValues(items: RawPrediction[]): Array<number | null> {
  const values: Array<number | null> = []
  for (const item of [...items].sort(
    (left, right) => (indexOf(left) as number) - (indexOf(right) as number)
  )) {
    values[indexOf(item) as number] = asNumber(valueOf(item, 'value'))
  }
  return values
}

function calculateRoundNumber(roundSlots: Array<number | null>): number | null {
  const firstValueIndex = roundSlots.findIndex((value) => value !== null && value !== -1)
  if (firstValueIndex < 0) return null
  const firstValue = roundSlots[firstValueIndex]
  if (firstValue === null || firstValue === -1) return null
  const nullCount = roundSlots.slice(0, firstValueIndex).filter((value) => value === null).length
  return firstValue - nullCount
}

function parsePlayer(frame: RawModelFrame, side: ScreenSide): BattlePlayerRecognition | null {
  const characters = predictions(frame, 'battle_character').filter((item) => sideOf(item) === side)
  const heads = predictions(frame, 'player_head_count').filter((item) => sideOf(item) === side)
  const dice = predictions(frame, 'card_dice_value').filter((item) => sideOf(item) === side)
  const points = predictions(frame, 'card_point_value').filter((item) => sideOf(item) === side)
  if (characters.length !== 1 || heads.length !== 1 || dice.length === 0) return null
  if (hasDuplicateIndex(dice) || hasDuplicateIndex(points)) return null
  return {
    gameRole: asRequiredString(valueOf(characters[0], 'value')) as string,
    headCount: asNumber(valueOf(heads[0], 'value')),
    cardDiceValues: indexedValues(dice),
    cardPointValues: indexedValues(points)
  }
}

function emptyPlayer(): LuckyPartyPlayerInfo {
  return { headCount: null, characterCode: null, cardDiceValues: [], cardPointValues: [] }
}

function toStructured(
  data: MapRecognitionData | BattleRecognitionData,
  capturedAt: string
): LuckyPartyRecognitionResult {
  const map = data.scene === 'map' ? data : undefined
  const battle = data.scene === 'battle' ? data : undefined
  return {
    schemaVersion: 2,
    capturedAt,
    roundInfo: map?.roundSlots ?? [],
    diceValues: map?.boardDice ?? [],
    characterCode: map?.gameRole ?? null,
    players: battle
      ? (battle.players.map((item) => ({
          headCount: item.headCount,
          characterCode: item.gameRole,
          cardDiceValues: item.cardDiceValues,
          cardPointValues: item.cardPointValues
        })) as [LuckyPartyPlayerInfo, LuckyPartyPlayerInfo])
      : [emptyPlayer(), emptyPlayer()]
  }
}

export function parseRawModelFrame(
  frame: RawModelFrame,
  capturedAt = frame.capturedAt
): GameRecognitionResult | undefined {
  const scene: RecognitionScene = predictions(frame, 'round_slot').length > 0 ? 'map' : 'battle'
  const allowedLabels = scene === 'map' ? MAP_LABELS : BATTLE_LABELS
  if (frame.predictions.some((prediction) => !allowedLabels.has(prediction.label))) return undefined
  if (frame.predictions.some((prediction) => !validatePrediction(prediction))) return undefined

  let data: MapRecognitionData | BattleRecognitionData
  let currentRound: number | null = null
  if (scene === 'map') {
    const roundSlots = predictions(frame, 'round_slot')
    const boardDice = predictions(frame, 'board_die')
    const characters = predictions(frame, 'map_character')
    if (characters.length !== 1 || hasDuplicateIndex(roundSlots) || hasDuplicateIndex(boardDice))
      return undefined
    const gameRole = asRequiredString(valueOf(characters[0], 'value'))
    if (!gameRole) return undefined
    const roundValues = indexedValues(roundSlots)
    currentRound = calculateRoundNumber(roundValues)
    data = {
      scene,
      roundSlots: roundValues,
      boardDice: indexedValues(boardDice),
      gameRole,
      roundNumber: currentRound
    }
  } else {
    const left = parsePlayer(frame, 'left')
    const right = parsePlayer(frame, 'right')
    if (!left || !right) return undefined
    data = { scene, players: [left, right] }
  }

  const originData = JSON.stringify(frame)
  const intermediate: RecognitionFrame = {
    frameId: frame.frameId,
    frameNumber: frame.frameNumber,
    capturedAt,
    originData,
    scene,
    roundNumber: currentRound,
    data
  }
  const structured = toStructured(data, capturedAt)
  const value =
    data.scene === 'map'
      ? [...data.boardDice].reverse().find((item): item is number => item !== null)
      : undefined
  return { scene, value, structured, originData, intermediate }
}
