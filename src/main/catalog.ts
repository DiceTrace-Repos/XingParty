import type { GameCatalogItem } from '../shared/types'
import { luckyPartyGame } from '../games/lucky-party'

export function fetchMockGameCatalog(): GameCatalogItem[] {
  return [{ id: luckyPartyGame.id, key: luckyPartyGame.key }]
}
