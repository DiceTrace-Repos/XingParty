import type { DiceEvent, DiceEventSourceType, FromSchema } from '../shared/types'
import type {
  BattlePlayerRecognition,
  MapRecognitionData,
  RecognitionFrame
} from './raw-model-output-parser'

export interface DiceEventContext {
  userDevice: string
  sessionId: string
  roundId: string
  createdAt: string
}

function source(
  context: DiceEventContext,
  type: DiceEventSourceType,
  gameRole: string,
  frameInfo: string,
  intermediateData: string,
  cardInfo?: FromSchema['cardInfo']
): FromSchema {
  return {
    type,
    userDevice: context.userDevice,
    sessionId: context.sessionId,
    roundId: context.roundId,
    gameRole,
    cardInfo,
    frameInfo,
    intermediateData
  }
}

function event(
  context: DiceEventContext,
  type: DiceEventSourceType,
  gameRole: string,
  value: number,
  frameInfo: string,
  intermediateData: string,
  cardInfo?: FromSchema['cardInfo']
): DiceEvent {
  return {
    value,
    from: source(context, type, gameRole, frameInfo, intermediateData, cardInfo),
    createdAt: context.createdAt
  }
}

function projectMap(
  data: MapRecognitionData,
  context: DiceEventContext,
  frame: RecognitionFrame,
  intermediateData: string
): DiceEvent[] {
  return data.boardDice.flatMap((value) =>
    value === null
      ? []
      : [event(context, 'map', data.gameRole, value, frame.originData, intermediateData)]
  )
}

function sumValues(values: Array<number | null>): number {
  let total = 0
  for (const value of values) {
    total += value ?? 0
  }
  return total
}

function projectPlayer(
  player: BattlePlayerRecognition,
  type: 'attack' | 'defence',
  context: DiceEventContext,
  frame: RecognitionFrame,
  intermediateData: string
): DiceEvent[] {
  if (player.headCount === null || player.cardDiceValues.length === 0) {
    return []
  }

  const rawValue = player.headCount - sumValues(player.cardDiceValues)
  if (rawValue < 0) {
    return []
  }

  const events = [
    event(context, 'raw', player.gameRole, rawValue, frame.originData, intermediateData)
  ]

  for (let index = 1; index < player.cardDiceValues.length; index += 1) {
    const value = player.cardDiceValues[index]
    const cost = player.cardPointValues[index - 1]
    if (value === null || cost === undefined || cost === null) {
      continue
    }
    events.push(
      event(context, 'card', player.gameRole, value, frame.originData, intermediateData, {
        type,
        cost
      })
    )
  }

  return events
}

export function projectRecognitionFrameToDiceEvents(
  frame: RecognitionFrame,
  context: DiceEventContext
): DiceEvent[] {
  const intermediateData = JSON.stringify(frame)
  if (frame.data.scene === 'map') {
    return projectMap(frame.data, context, frame, intermediateData)
  }

  const [attack, defence] = frame.data.players
  return [
    ...projectPlayer(attack, 'attack', context, frame, intermediateData),
    ...projectPlayer(defence, 'defence', context, frame, intermediateData)
  ]
}
