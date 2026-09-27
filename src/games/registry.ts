import type { GameAdapter } from './types'
import { luckyPartyAdapter } from './lucky-party/adapter'

const adapters: Readonly<Record<string, GameAdapter>> = {
  [luckyPartyAdapter.key]: luckyPartyAdapter
}

export function getGameAdapter(key: string): GameAdapter | undefined {
  return adapters[key]
}

export function listGameAdapters(): GameAdapter[] {
  return Object.values(adapters)
}
