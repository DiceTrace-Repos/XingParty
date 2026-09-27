export interface GameMeta {
  key: string
  nameKey: string
  shortName: string
  iconLabel: string
}

export const GAME_META: Record<string, GameMeta> = {
  'lucky-party': {
    key: 'lucky-party',
    nameKey: 'games.luckyParty.name',
    shortName: 'LP',
    iconLabel: 'Lucky Party'
  }
}

export function getGameMeta(key: string): GameMeta | undefined {
  return GAME_META[key]
}
