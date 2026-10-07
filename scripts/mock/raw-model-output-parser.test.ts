import assert from 'node:assert/strict'
import test from 'node:test'
import { parseRawModelFrame } from '../../src/games/lucky-party/raw-model-output-parser.ts'
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

test('parses indexed map values and keeps null and -1 semantics', () => {
  const mapFrame = frame([
    prediction('round-2', 'round_slot', 0.8, { index: 2, value: '-1' }),
    prediction('round-0', 'round_slot', 0.9, { index: 0, value: '1' }),
    prediction('round-1', 'round_slot', 0.7, { index: 1, value: 'null' }),
    prediction('die-1', 'board_die', 0.6, { index: 1, value: 'null' }),
    prediction('die-0', 'board_die', 1, { index: 0, value: '4' }),
    prediction('character', 'map_character', 0.95, { value: '123' })
  ])
  const result = parseRawModelFrame(mapFrame, '2026-10-06T01:00:00.000Z')

  assert.equal(result.scene, 'map')
  assert.equal(result.phase, 'move')
  assert.equal(result.value, 4)
  assert.deepEqual(result.structured?.roundInfo, [1, null, -1])
  assert.deepEqual(result.structured?.diceValues, [4, null])
  assert.equal(result.structured?.characterCode, '123')
  assert.equal(result.structured?.capturedAt, '2026-10-06T01:00:00.000Z')
})

test('parses battle players in left-right order and classifies IDs', () => {
  const battleFrame = frame([
    prediction('left-character', 'battle_character', 0.9, { side: 'left', value: '1002' }),
    prediction('right-character', 'battle_character', 0.91, { side: 'right', value: '135' }),
    prediction('left-head', 'player_head_count', 0.8, { side: 'left', value: 'null' }),
    prediction('right-head', 'player_head_count', 0.81, { side: 'right', value: '8' }),
    prediction('right-dice-1', 'card_dice_value', 0.7, {
      side: 'right',
      index: 1,
      value: 12
    }),
    prediction('right-dice-0', 'card_dice_value', 0.75, {
      side: 'right',
      index: 0,
      value: 5
    }),
    prediction('right-point-0', 'card_point_value', 0.85, {
      side: 'right',
      index: 0,
      value: '3'
    })
  ])
  const result = parseRawModelFrame(battleFrame)
  const [left, right] = result.structured?.players ?? []

  assert.equal(result.scene, 'battle')
  assert.equal(result.phase, 'unknown')
  assert.equal(result.side, 'self')
  assert.equal(result.value, 12)
  assert.equal(left?.characterCode, '1002')
  assert.equal(left?.characterType, 'monster')
  assert.equal(left?.headCount, null)
  assert.equal(right?.characterCode, '135')
  assert.equal(right?.characterType, 'role')
  assert.equal(right?.headCount, 8)
  assert.deepEqual(right?.cardDiceValues, [5, 12])
  assert.deepEqual(right?.cardPointValues, [3])
})

test('infers battle from partial battle-only labels', () => {
  const partialFrame = frame([
    prediction('left-head', 'player_head_count', 0.9, { side: 'left', value: '7' }),
    prediction('left-dice', 'card_dice_value', 0.8, { side: 'left', index: 0, value: 6 })
  ])

  assert.equal(parseRawModelFrame(partialFrame).scene, 'battle')
})
