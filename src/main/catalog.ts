import type { GameCatalogItem } from '../shared/types'
import { listGameAdapters } from '../games/registry'

export function fetchMockGameCatalog(): GameCatalogItem[] {
  return listGameAdapters().map(({ id, key }) => ({ id, key }))
}
