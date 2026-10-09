import assert from 'node:assert/strict'
import test from 'node:test'
import { parseRawModelFrame } from '../../src/games/raw-model-output-parser.ts'
import { LuckyPartyRecognitionStateMachine } from '../../src/games/recognition-state-machine.ts'
import { projectRecognitionFrameToDiceEvents } from '../../src/games/dice-event-projector.ts'
import type { RawModelFrame, RawPrediction } from '../../src/shared/raw-model-output.ts'

function prediction(
  detectionId: string,
  label: RawPrediction['label'],
  confidence: number,
  attributes: RawPrediction['attributes']
): RawPrediction {
  return { detectionId, label, confidence, bbox: [0, 0, 10, 10], attributes }
}

function frame(predictions: RawPrediction[]): RawModelFrame {
  return {
    frameId: 'test-frame',
    frameNumber: 0,
    capturedAt: '2026-10-06T00:00:00.000Z',
    image: { width: 1920, height: 1080 },
    predictions
  }
}

test('rebuilds map arrays using the model indexes and calculates the round', () => {
  const result = parseRawModelFrame(
    frame([
      prediction('round-0', 'round_slot', 0.9, { index: 0, value: '1' }),
      prediction('round-1', 'round_slot', 0.9, { index: 1, value: 'null' }),
      prediction('round-2', 'round_slot', 0.9, { index: 2, value: '3' }),
      prediction('die-0', 'board_die', 0.9, { index: 0, value: '4' }),
      prediction('character', 'map_character', 0.95, { value: '123' })
    ]),
    '2026-10-06T01:00:00.000Z'
  )

  assert.ok(result)
  assert.equal(result.scene, 'map')
  assert.equal(result.value, 4)
  assert.equal(result.intermediate?.roundNumber, 1)
  assert.deepEqual(result.intermediate?.data, {
    scene: 'map',
    roundSlots: [1, null, 3],
    boardDice: [4],
    gameRole: '123',
    roundNumber: 1
  })
  assert.equal(result.structured?.schemaVersion, 2)
  assert.equal(JSON.parse(result.originData).frameId, 'test-frame')
})

test('rebuilds battle players as left-right fixed positions and allows missing points', () => {
  const result = parseRawModelFrame(
    frame([
      prediction('left-character', 'battle_character', 0.9, { side: 'left', value: '1002' }),
      prediction('right-character', 'battle_character', 0.91, { side: 'right', value: '135' }),
      prediction('left-head', 'player_head_count', 0.8, { side: 'left', value: 'null' }),
      prediction('left-dice', 'card_dice_value', 0.9, {
        side: 'left',
        index: 0,
        value: 6
      }),
      prediction('right-head', 'player_head_count', 0.81, { side: 'right', value: '8' }),
      prediction('right-dice-1', 'card_dice_value', 0.9, {
        side: 'right',
        index: 1,
        value: 12
      }),
      prediction('right-dice-0', 'card_dice_value', 0.9, {
        side: 'right',
        index: 0,
        value: 5
      })
    ])
  )

  assert.ok(result)
  assert.equal(result.scene, 'battle')
  assert.deepEqual(result.intermediate?.data, {
    scene: 'battle',
    players: [
      { gameRole: '1002', headCount: null, cardDiceValues: [6], cardPointValues: [] },
      { gameRole: '135', headCount: 8, cardDiceValues: [5, 12], cardPointValues: [] }
    ]
  })
})

test('rejects the entire frame when a prediction is below its threshold', () => {
  const result = parseRawModelFrame(
    frame([
      prediction('round-0', 'round_slot', 0.9, { index: 0, value: '1' }),
      prediction('die-0', 'board_die', 0.79, { index: 0, value: '4' }),
      prediction('character', 'map_character', 0.95, { value: '123' })
    ])
  )

  assert.equal(result, undefined)
})

test('ends the game after ten frames with no labels', () => {
  const stateMachine = new LuckyPartyRecognitionStateMachine()

  for (let index = 0; index < 10; index += 1) {
    stateMachine.processNoLabelFrame()
  }

  assert.equal(stateMachine.getState().gameEnded, true)
  assert.equal(stateMachine.getState().missedLabelFrameCount, 10)
})

test('projects map dice and battle raw/card dice events from the final intermediate frame', () => {
  const mapResult = parseRawModelFrame(
    frame([
      prediction('round-0', 'round_slot', 0.9, { index: 0, value: '1' }),
      prediction('die-0', 'board_die', 0.9, { index: 0, value: '4' }),
      prediction('die-1', 'board_die', 0.9, { index: 1, value: '6' }),
      prediction('character', 'map_character', 0.95, { value: '115' })
    ])
  )
  assert.ok(mapResult?.intermediate)
  const mapEvents = projectRecognitionFrameToDiceEvents(mapResult.intermediate, {
    userDevice: 'device',
    sessionId: 'session',
    roundId: 'round',
    createdAt: '2026-10-06T01:00:00.000Z'
  })
  assert.deepEqual(
    mapEvents.map((event) => event.value),
    [4, 6]
  )
  assert.equal(mapEvents[0]?.from.gameRole, '115')
  assert.deepEqual(
    mapEvents.map((event) => event.from.type),
    ['map', 'map']
  )

  const battleResult = parseRawModelFrame(
    frame([
      prediction('left-character', 'battle_character', 0.9, { side: 'left', value: '105' }),
      prediction('left-head', 'player_head_count', 0.9, { side: 'left', value: 20 }),
      prediction('left-base', 'card_dice_value', 0.9, { side: 'left', index: 0, value: 5 }),
      prediction('left-card', 'card_dice_value', 0.9, { side: 'left', index: 1, value: 7 }),
      prediction('left-cost', 'card_point_value', 0.9, { side: 'left', index: 0, value: 2 }),
      prediction('right-character', 'battle_character', 0.9, { side: 'right', value: '1002' }),
      prediction('right-head', 'player_head_count', 0.9, { side: 'right', value: 15 }),
      prediction('right-base', 'card_dice_value', 0.9, { side: 'right', index: 0, value: 3 })
    ])
  )
  assert.ok(battleResult?.intermediate)
  const battleEvents = projectRecognitionFrameToDiceEvents(battleResult.intermediate, {
    userDevice: 'device',
    sessionId: 'session',
    roundId: 'round',
    createdAt: '2026-10-06T01:00:00.000Z'
  })
  assert.deepEqual(
    battleEvents.map((event) => event.value),
    [8, 7, 12]
  )
  assert.deepEqual(
    battleEvents.map((event) => event.from.type),
    ['raw', 'card', 'raw']
  )
  assert.deepEqual(battleEvents[1]?.from.cardInfo, { type: 'attack', cost: 2 })
})
