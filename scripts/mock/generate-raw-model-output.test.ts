import assert from 'node:assert/strict'
import test from 'node:test'
import { generateRawModelOutput, validateRawModelOutput } from './generate-raw-model-output.ts'

test('generates eight rounds of valid raw predictions', () => {
  const output = generateRawModelOutput(
    {
      version: '20261006000000',
      contents: [
        ...Array.from({ length: 8 }, (_, index) => ({ game_id: String(100 + index) })),
        ...Array.from({ length: 3 }, (_, index) => ({ game_id: String(1001 + index) }))
      ]
    },
    7
  )

  validateRawModelOutput(output)
  assert.equal(output.schemaVersion, 2)
  assert.equal(
    output.frames.filter((frame) =>
      frame.predictions.some((prediction) => prediction.label === 'map_character')
    ).length,
    32
  )
  assert.deepEqual(
    [
      ...new Set(output.frames.flatMap((frame) => frame.predictions.map((item) => item.label)))
    ].sort(),
    [
      'battle_character',
      'board_die',
      'card_dice_value',
      'card_point_value',
      'map_character',
      'player_head_count',
      'round_slot'
    ]
  )

  const expectedAttributeKeys = {
    board_die: ['index', 'value'],
    round_slot: ['index', 'value'],
    player_head_count: ['side', 'value'],
    map_character: ['value'],
    battle_character: ['side', 'value'],
    card_dice_value: ['index', 'side', 'value'],
    card_point_value: ['index', 'side', 'value']
  } as const

  for (const frame of output.frames) {
    assert.equal('fixtureContext' in frame, false)
    for (const prediction of frame.predictions) {
      assert.deepEqual(
        Object.keys(prediction.attributes).sort(),
        [...expectedAttributeKeys[prediction.label]].sort(),
        prediction.label
      )
    }
  }
})
