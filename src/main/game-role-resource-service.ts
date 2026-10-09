import type { GameRoleResourceItem, GameRoleResourceSnapshot } from '../shared/types'
import { getApiUrl } from './api-config'
import { appLogger } from './app-logger'
import type { LocalStore } from './local-store'

const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000
const REQUEST_TIMEOUT_MS = 10_000

export class GameRoleResourceService {
  private refreshTimer?: NodeJS.Timeout
  private refreshInFlight?: Promise<GameRoleResourceSnapshot>

  constructor(
    private readonly localStore: LocalStore,
    private readonly endpoint = getApiUrl('game-roles')
  ) {}

  start(): void {
    void this.refresh().catch(() => undefined)
    this.refreshTimer = setInterval(() => {
      void this.refresh().catch(() => undefined)
    }, REFRESH_INTERVAL_MS)
    this.refreshTimer.unref()
  }

  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = undefined
    }
  }

  refresh(): Promise<GameRoleResourceSnapshot> {
    if (this.refreshInFlight) {
      return this.refreshInFlight
    }

    const request = this.fetchAndStore().finally(() => {
      this.refreshInFlight = undefined
    })
    this.refreshInFlight = request
    return request
  }

  private async fetchAndStore(): Promise<GameRoleResourceSnapshot> {
    appLogger.info('resources', '正在请求游戏角色资源', { endpoint: this.endpoint })
    try {
      const response = await fetch(this.endpoint, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const resource = parseGameRoleResource(await response.json())
      const snapshot: GameRoleResourceSnapshot = {
        ...resource,
        updatedAt: new Date().toISOString()
      }
      this.localStore.saveGameRoleResource(snapshot)
      appLogger.info('resources', '游戏角色资源已更新', {
        endpoint: this.endpoint,
        version: snapshot.version,
        count: snapshot.contents.length
      })
      return snapshot
    } catch (error) {
      const reason = getRequestErrorMessage(error)
      appLogger.error('resources', '游戏角色资源更新失败，继续使用本地资源', {
        endpoint: this.endpoint,
        error: reason
      })
      throw new Error(`无法从 ${this.endpoint} 更新资源：${reason}`)
    }
  }
}

function parseGameRoleResource(value: unknown): Omit<GameRoleResourceSnapshot, 'updatedAt'> {
  if (!isRecord(value) || typeof value.version !== 'string' || !/^\d{14}$/.test(value.version)) {
    throw new Error('game-roles 响应缺少有效的 version')
  }
  if (!Array.isArray(value.contents) || !value.contents.every(isGameRoleResourceItem)) {
    throw new Error('game-roles 响应包含无效的 contents')
  }
  return { version: value.version, contents: value.contents }
}

function isGameRoleResourceItem(value: unknown): value is GameRoleResourceItem {
  return (
    isRecord(value) &&
    (typeof value.game_id === 'string' || value.game_id === null) &&
    (typeof value.avatar === 'string' || value.avatar === null) &&
    typeof value.name === 'string'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function getRequestErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error)
  }

  const cause = error.cause
  if (cause instanceof Error && cause.message) {
    return `${error.message}: ${cause.message}`
  }
  return error.message
}
