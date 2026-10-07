export type ModelLabel =
  | 'board_die'
  | 'round_slot'
  | 'player_head_count'
  | 'map_character'
  | 'battle_character'
  | 'card_dice_value'
  | 'card_point_value'

export interface RawPrediction {
  detectionId: string
  label: ModelLabel
  confidence: number
  bbox: [x1: number, y1: number, x2: number, y2: number]
  attributes: Record<string, string | number>
}

export interface RawModelFrame {
  frameId: string
  frameNumber: number
  capturedAt: string
  image: { width: number; height: number }
  predictions: RawPrediction[]
}

export interface RawModelOutputFixture {
  schemaVersion: 2
  model: { name: string; version: string }
  roleSnapshotVersion: string
  generatedAt: string
  frames: RawModelFrame[]
}
