import { randomUUID } from 'crypto'
import { fetchMockGameCatalog } from './catalog'
import { EncryptedStorage } from './encrypted-storage'
import type {
  BootstrapState,
  ClientSettingsUpdate,
  ClientState,
  DiceEvent,
  DiceStatistics,
  DiceStatisticsEntry,
  GameRoleResourceSnapshot,
  PlaySession,
  RecentDiceEvent,
  RecognitionRecord,
  Round,
  StoredGame
} from '../shared/types'
import type { GameRecognitionResult } from '../games/types'
import { projectRecognitionFrameToDiceEvents } from '../games/dice-event-projector'

const FILES = {
  client: 'client_state',
  games: 'games_cache',
  gameRoleResource: 'game_roles_resource',
  legacyEvents: 'dice_events',
  recognitionResults: 'recognition_results'
}

interface LocalDiceEventRecord {
  id: string
  event: DiceEvent
}

interface LegacyDiceEventRecord extends LocalDiceEventRecord {
  gameKey: string
}

function isLocalDiceEventRecord(record: unknown): record is LocalDiceEventRecord {
  if (!record || typeof record !== 'object') return false
  const stored = record as Partial<LocalDiceEventRecord>
  const event = stored.event
  const from = event?.from
  return (
    typeof stored.id === 'string' &&
    typeof event?.value === 'number' &&
    typeof event.createdAt === 'string' &&
    typeof from?.type === 'string' &&
    typeof from.userDevice === 'string' &&
    typeof from.sessionId === 'string' &&
    typeof from.roundId === 'string' &&
    typeof from.gameRole === 'string' &&
    typeof from.frameInfo === 'string' &&
    typeof from.intermediateData === 'string'
  )
}

function isLegacyDiceEventRecord(record: unknown): record is LegacyDiceEventRecord {
  return (
    isLocalDiceEventRecord(record) &&
    typeof (record as Partial<LegacyDiceEventRecord>).gameKey === 'string'
  )
}

function getDiceEventsCollection(gameKey: string): string {
  return `dice_events_${encodeURIComponent(gameKey)}`
}

export class LocalStore {
  private readonly activeSessionIds = new Map<string, string>()
  private readonly activeRoundIds = new Map<string, { id: string; roundIndex: number }>()
  private readonly diceStatisticsSnapshots = new Map<string, DiceStatistics>()
  constructor(
    private readonly storage: EncryptedStorage,
    private readonly defaultGamePath = ''
  ) {}

  getBootstrapState(recognitionRunning: boolean): BootstrapState {
    this.ensureInitialized()

    const client = this.getClient()
    const games = this.getGames()
    const activeGame = games.find((game) => game.key === client.activeGameKey) ?? games[0]

    if (activeGame && client.activeGameKey !== activeGame.key) {
      this.saveClient({
        ...client,
        activeGameKey: activeGame.key,
        updatedAt: new Date().toISOString()
      })
    }

    return {
      client: this.getClient(),
      games,
      activeGame,
      gameRoleResource: this.getGameRoleResource(),
      recentEvents: activeGame ? this.getRecentEvents(activeGame.key, 12) : [],
      diceStatistics: activeGame
        ? this.getVisibleDiceStatistics(activeGame.key, recognitionRunning)
        : undefined,
      latestRecognition: activeGame ? this.getLatestRecognition(activeGame.key) : undefined,
      recognitionRunning
    }
  }

  refreshGames(): StoredGame[] {
    const now = new Date().toISOString()
    const games = fetchMockGameCatalog().map((game) => ({ ...game, cachedAt: now }))

    this.storage.writeCollection<StoredGame>(FILES.games, games)

    const client = this.getClient()
    if (!client.activeGameKey && games[0]) {
      this.saveClient({ ...client, activeGameKey: games[0].key, updatedAt: now })
    }

    return games
  }

  getGameRoleResource(): GameRoleResourceSnapshot | undefined {
    return this.storage.readCollection<GameRoleResourceSnapshot>(FILES.gameRoleResource, [])[0]
  }

  saveGameRoleResource(resource: GameRoleResourceSnapshot): void {
    this.storage.writeCollection<GameRoleResourceSnapshot>(FILES.gameRoleResource, [resource])
  }

  setActiveGame(key: string): BootstrapState {
    const client = this.getClient()
    this.saveClient({ ...client, activeGameKey: key, updatedAt: new Date().toISOString() })
    return this.getBootstrapState(false)
  }

  updateClientSettings(update: ClientSettingsUpdate): ClientState {
    const client = this.getClient()
    const nextClient: ClientState = {
      ...client,
      gamePath:
        update.gamePath === undefined
          ? client.gamePath
          : update.gamePath.trim() || this.defaultGamePath,
      autoShareData:
        update.autoShareData === undefined ? client.autoShareData : update.autoShareData,
      updatedAt: new Date().toISOString()
    }

    this.saveClient(nextClient)
    return nextClient
  }

  appendMockRecognitionEvent(gameKey: string): void {
    const game = this.getGames().find((item) => item.key === gameKey)

    if (!game) {
      return
    }

    const now = new Date().toISOString()
    const session = this.ensureSession(game.id, game.key, now)
    const round = this.ensureRound(game.id, game.key, session.id, now)
    const event = this.createMockDiceEvent(session.id, round.id, now, this.getClient().clientId)
    this.appendEvent(game.key, event)
  }

  appendRecognitionEvent(gameKey: string, result: GameRecognitionResult): void {
    const game = this.getGames().find((item) => item.key === gameKey)

    if (!game) {
      return
    }

    const now = result.structured?.capturedAt ?? new Date().toISOString()
    const session = this.ensureSession(game.id, game.key, now)
    const round = this.ensureRound(
      game.id,
      game.key,
      session.id,
      now,
      result.intermediate?.roundNumber
    )
    if (result.structured) {
      const records = this.storage.readCollection<RecognitionRecord>(FILES.recognitionResults, [])
      const record: RecognitionRecord = {
        id: randomUUID(),
        gameId: game.id,
        gameKey: game.key,
        capturedAt: now,
        scene: result.scene,
        value: result.value,
        structured: result.structured,
        originData: result.originData
      }
      this.storage.writeCollection<RecognitionRecord>(
        FILES.recognitionResults,
        [...records, record].slice(-500)
      )
    }

    if (!result.intermediate) {
      return
    }

    const events = projectRecognitionFrameToDiceEvents(result.intermediate, {
      userDevice: this.getClient().clientId,
      sessionId: session.id,
      roundId: round.id,
      createdAt: now
    })
    for (const event of events) {
      this.appendEvent(game.key, event)
    }
  }

  private appendEvent(gameKey: string, event: DiceEvent): void {
    const events = this.readDiceEvents(gameKey)
    const stored: LocalDiceEventRecord = { id: randomUUID(), event }
    this.storage.writeCollection<LocalDiceEventRecord>(getDiceEventsCollection(gameKey), [
      ...events,
      stored
    ])
  }

  beginRecognitionSession(gameKey: string): void {
    this.diceStatisticsSnapshots.set(gameKey, this.getDiceStatistics(gameKey))
  }

  completeActiveSession(gameKey: string, endedAt = new Date().toISOString()): void {
    void endedAt
    this.activeSessionIds.delete(gameKey)
    this.activeRoundIds.delete(gameKey)
    this.diceStatisticsSnapshots.set(gameKey, this.getDiceStatistics(gameKey))
  }

  private ensureInitialized(): void {
    if (this.storage.readCollection<ClientState>(FILES.client, []).length === 0) {
      const now = new Date().toISOString()
      this.storage.writeCollection<ClientState>(FILES.client, [
        {
          clientId: randomUUID(),
          locale: 'zh-CN',
          gamePath: this.defaultGamePath,
          autoShareData: false,
          createdAt: now,
          updatedAt: now
        }
      ])
    } else {
      const client = this.storage.readCollection<ClientState>(FILES.client, [])[0]

      if (
        client &&
        (typeof client.gamePath !== 'string' ||
          (client.gamePath.trim() === '' && this.defaultGamePath !== '') ||
          typeof client.autoShareData !== 'boolean')
      ) {
        this.saveClient({
          ...client,
          gamePath:
            typeof client.gamePath === 'string' && client.gamePath.trim() !== ''
              ? client.gamePath
              : this.defaultGamePath,
          autoShareData: typeof client.autoShareData === 'boolean' ? client.autoShareData : false,
          updatedAt: new Date().toISOString()
        })
      }
    }

    if (this.getGames().length === 0) {
      this.refreshGames()
    }
  }

  private getClient(): ClientState {
    const client = this.storage.readCollection<ClientState>(FILES.client, [])[0]

    if (!client) {
      this.ensureInitialized()
      return this.storage.readCollection<ClientState>(FILES.client, [])[0]
    }

    return client
  }

  private saveClient(client: ClientState): void {
    this.storage.writeCollection<ClientState>(FILES.client, [client])
  }

  private getGames(): StoredGame[] {
    return this.storage.readCollection<StoredGame>(FILES.games, [])
  }

  private getRecentEvents(gameKey: string, limit: number): RecentDiceEvent[] {
    const events = this.readDiceEvents(gameKey)
      .sort((left, right) => right.event.createdAt.localeCompare(left.event.createdAt))
      .slice(0, limit)

    return events.map(({ id, event }) => ({ ...event, id, gameKey }))
  }

  private getDiceStatistics(gameKey: string): DiceStatistics {
    const events = this.readDiceEvents(gameKey)
    const sessionTimes = new Map<string, string>()
    const roundTimes = new Map<string, { sessionId: string; firstSeenAt: string }>()
    const counts = new Map<string, DiceStatisticsEntry>()

    for (const stored of events) {
      const event = stored.event
      const sessionId = event.from.sessionId
      const roundId = event.from.roundId
      if (!sessionTimes.has(sessionId) || event.createdAt < sessionTimes.get(sessionId)!) {
        sessionTimes.set(sessionId, event.createdAt)
      }
      const existingRound = roundTimes.get(roundId)
      if (!existingRound || event.createdAt < existingRound.firstSeenAt) {
        roundTimes.set(roundId, { sessionId, firstSeenAt: event.createdAt })
      }
      if (
        !['map', 'raw', 'card'].includes(event.from.type) ||
        !Number.isInteger(event.value) ||
        event.value < 1
      )
        continue
      const key = [sessionId, roundId, event.from.gameRole, event.from.type, event.value].join(
        '\u0000'
      )
      const existing = counts.get(key)
      if (existing) {
        existing.count += 1
      } else {
        counts.set(key, {
          sessionId,
          roundId,
          gameRole: event.from.gameRole,
          type: event.from.type,
          value: event.value,
          count: 1
        })
      }
    }

    const sessions = [...sessionTimes.entries()]
      .sort(([, left], [, right]) => right.localeCompare(left))
      .map(([id, startedAt]) => ({ id, startedAt }))
    const roundGroups = new Map<string, Array<[string, string]>>()
    for (const [roundId, round] of roundTimes) {
      const group = roundGroups.get(round.sessionId) ?? []
      group.push([roundId, round.firstSeenAt])
      roundGroups.set(round.sessionId, group)
    }
    const rounds = [...roundTimes.entries()]
      .sort(([, left], [, right]) => left.firstSeenAt.localeCompare(right.firstSeenAt))
      .map(([id, round]) => ({
        id,
        sessionId: round.sessionId,
        roundIndex:
          (roundGroups.get(round.sessionId) ?? [])
            .sort(([, left], [, right]) => left.localeCompare(right))
            .findIndex(([roundId]) => roundId === id) + 1
      }))

    return { sessions, rounds, entries: [...counts.values()] }
  }

  private getVisibleDiceStatistics(gameKey: string, recognitionRunning: boolean): DiceStatistics {
    if (!recognitionRunning) {
      const statistics = this.getDiceStatistics(gameKey)
      this.diceStatisticsSnapshots.set(gameKey, statistics)
      return statistics
    }

    const snapshot = this.diceStatisticsSnapshots.get(gameKey)
    if (snapshot) {
      return snapshot
    }

    const statistics = this.getDiceStatistics(gameKey)
    this.diceStatisticsSnapshots.set(gameKey, statistics)
    return statistics
  }

  private readDiceEvents(gameKey: string): LocalDiceEventRecord[] {
    const current = this.storage
      .readCollection<unknown>(getDiceEventsCollection(gameKey), [])
      .filter(isLocalDiceEventRecord)
    const legacy = this.storage
      .readCollection<unknown>(FILES.legacyEvents, [])
      .filter(isLegacyDiceEventRecord)
      .filter((stored) => stored.gameKey === gameKey)
      .map(({ id, event }) => ({ id, event }))

    return [...new Map([...legacy, ...current].map((record) => [record.id, record])).values()]
  }

  private getLatestRecognition(gameKey: string): RecognitionRecord | undefined {
    return this.storage
      .readCollection<RecognitionRecord>(FILES.recognitionResults, [])
      .filter((record) => record.gameKey === gameKey)
      .sort((left, right) => right.capturedAt.localeCompare(left.capturedAt))[0]
  }

  private ensureSession(gameId: string, gameKey: string, now: string): PlaySession {
    const existingId = this.activeSessionIds.get(gameKey)
    if (existingId) return { id: existingId, gameId, gameKey, startedAt: now, status: 'active' }
    const session: PlaySession = {
      id: randomUUID(),
      gameId,
      gameKey,
      startedAt: now,
      status: 'active'
    }
    this.activeSessionIds.set(gameKey, session.id)
    this.activeRoundIds.delete(gameKey)
    return session
  }

  private ensureRound(
    gameId: string,
    gameKey: string,
    sessionId: string,
    now: string,
    detectedRoundIndex?: number | null
  ): Round {
    const active = this.activeRoundIds.get(gameKey)
    if (active && (detectedRoundIndex == null || active.roundIndex === detectedRoundIndex)) {
      return {
        id: active.id,
        sessionId,
        gameId,
        gameKey,
        roundIndex: active.roundIndex,
        remoteControlUsed: false,
        remoteControlDetectedBy: 'unknown',
        startedAt: now
      }
    }
    const round: Round = {
      id: randomUUID(),
      sessionId,
      gameId,
      gameKey,
      roundIndex: detectedRoundIndex ?? (active?.roundIndex ?? 0) + 1,
      remoteControlUsed: false,
      remoteControlDetectedBy: 'unknown',
      startedAt: now
    }

    this.activeRoundIds.set(gameKey, { id: round.id, roundIndex: round.roundIndex })
    return round
  }

  private createMockDiceEvent(
    sessionId: string,
    roundId: string,
    now: string,
    userDevice: string
  ): DiceEvent {
    return {
      value: Math.floor(Math.random() * 6) + 1,
      from: {
        type: 'raw',
        userDevice,
        sessionId,
        roundId,
        gameRole: 'mock-role',
        frameInfo: JSON.stringify({ source: 'mock' }),
        intermediateData: JSON.stringify({ source: 'mock' })
      },
      createdAt: now
    }
  }
}
