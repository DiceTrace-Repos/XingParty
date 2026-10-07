import { randomUUID } from 'crypto'
import { fetchMockGameCatalog } from './catalog'
import { EncryptedStorage } from './encrypted-storage'
import type {
  BootstrapState,
  ClientState,
  DiceEvent,
  DiceValueStep,
  PlaySession,
  RecentDiceEvent,
  RecognitionRecord,
  Round,
  StoredGame
} from '../shared/types'
import type { GameRecognitionResult } from '../games/types'

const FILES = {
  client: 'client_state',
  games: 'games_cache',
  sessions: 'sessions',
  rounds: 'rounds',
  events: 'dice_events',
  steps: 'dice_value_steps',
  recognitionResults: 'recognition_results'
}

export class LocalStore {
  constructor(private readonly storage: EncryptedStorage) {}

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
      recentEvents: activeGame ? this.getRecentEvents(activeGame.key, 12) : [],
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

  setActiveGame(key: string): BootstrapState {
    const client = this.getClient()
    this.saveClient({ ...client, activeGameKey: key, updatedAt: new Date().toISOString() })
    return this.getBootstrapState(false)
  }

  appendMockRecognitionEvent(gameKey: string): void {
    const game = this.getGames().find((item) => item.key === gameKey)

    if (!game) {
      return
    }

    const now = new Date().toISOString()
    const session = this.ensureSession(game.id, game.key, now)
    const round = this.ensureRound(game.id, game.key, session.id, now)
    const event = this.createMockDiceEvent(game.id, game.key, session.id, round.id, now)
    this.appendEvent(event, this.createMockSteps(event.id, event.confidence))
  }

  appendRecognitionEvent(
    gameKey: string,
    result: GameRecognitionResult,
    rawFrame?: RecognitionRecord['rawFrame']
  ): void {
    const game = this.getGames().find((item) => item.key === gameKey)

    if (!game) {
      return
    }

    const now = result.structured?.capturedAt ?? new Date().toISOString()
    const session = this.ensureSession(game.id, game.key, now)
    const round = this.ensureRound(game.id, game.key, session.id, now)
    const event: DiceEvent = {
      id: randomUUID(),
      gameId: game.id,
      gameKey: game.key,
      sessionId: session.id,
      roundId: round.id,
      scene: result.scene,
      phase: result.phase,
      side: result.side,
      confidence: result.confidence,
      capturedAt: now,
      createdAt: now
    }
    const steps = result.value === undefined ? [] : this.createValueSteps(event.id, result)
    this.appendEvent(event, steps)

    if (result.structured) {
      const records = this.storage.readCollection<RecognitionRecord>(FILES.recognitionResults, [])
      const record: RecognitionRecord = {
        id: randomUUID(),
        gameId: game.id,
        gameKey: game.key,
        capturedAt: now,
        scene: result.scene,
        phase: result.phase,
        side: result.side,
        confidence: result.confidence,
        value: result.value,
        structured: result.structured,
        rawFrame
      }
      this.storage.writeCollection<RecognitionRecord>(
        FILES.recognitionResults,
        [...records, record].slice(-500)
      )
    }
  }

  private appendEvent(event: DiceEvent, steps: DiceValueStep[]): void {
    const events = this.storage.readCollection<DiceEvent>(FILES.events, [])
    const allSteps = this.storage.readCollection<DiceValueStep>(FILES.steps, [])

    this.storage.writeCollection<DiceEvent>(FILES.events, [...events, event])
    this.storage.writeCollection<DiceValueStep>(FILES.steps, [...allSteps, ...steps])
  }

  private ensureInitialized(): void {
    if (this.storage.readCollection<ClientState>(FILES.client, []).length === 0) {
      const now = new Date().toISOString()
      this.storage.writeCollection<ClientState>(FILES.client, [
        {
          clientId: randomUUID(),
          locale: 'zh-CN',
          createdAt: now,
          updatedAt: now
        }
      ])
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
    const events = this.storage
      .readCollection<DiceEvent>(FILES.events, [])
      .filter((event) => event.gameKey === gameKey)
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
      .slice(0, limit)
    const steps = this.storage.readCollection<DiceValueStep>(FILES.steps, [])

    return events.map((event) => {
      const eventSteps = steps
        .filter((step) => step.eventId === event.id)
        .sort((a, b) => a.sequenceIndex - b.sequenceIndex)
      const lastStep = eventSteps[eventSteps.length - 1]

      return {
        ...event,
        finalValue: lastStep?.finalValue ?? 0,
        stepCount: eventSteps.length
      }
    })
  }

  private getLatestRecognition(gameKey: string): RecognitionRecord | undefined {
    return this.storage
      .readCollection<RecognitionRecord>(FILES.recognitionResults, [])
      .filter((record) => record.gameKey === gameKey)
      .sort((left, right) => right.capturedAt.localeCompare(left.capturedAt))[0]
  }

  private ensureSession(gameId: string, gameKey: string, now: string): PlaySession {
    const sessions = this.storage.readCollection<PlaySession>(FILES.sessions, [])
    const active = sessions.find(
      (session) => session.gameKey === gameKey && session.status === 'active'
    )

    if (active) {
      return active
    }

    const session: PlaySession = {
      id: randomUUID(),
      gameId,
      gameKey,
      startedAt: now,
      status: 'active'
    }

    this.storage.writeCollection<PlaySession>(FILES.sessions, [...sessions, session])
    return session
  }

  private ensureRound(gameId: string, gameKey: string, sessionId: string, now: string): Round {
    const rounds = this.storage.readCollection<Round>(FILES.rounds, [])
    const active = rounds.find((round) => round.sessionId === sessionId && !round.endedAt)

    if (active) {
      return active
    }

    const round: Round = {
      id: randomUUID(),
      sessionId,
      gameId,
      gameKey,
      roundIndex: rounds.filter((item) => item.sessionId === sessionId).length + 1,
      remoteControlUsed: false,
      remoteControlDetectedBy: 'unknown',
      startedAt: now
    }

    this.storage.writeCollection<Round>(FILES.rounds, [...rounds, round])
    return round
  }

  private createMockDiceEvent(
    gameId: string,
    gameKey: string,
    sessionId: string,
    roundId: string,
    now: string
  ): DiceEvent {
    const battle = Math.random() > 0.45

    return {
      id: randomUUID(),
      gameId,
      gameKey,
      sessionId,
      roundId,
      scene: battle ? 'battle' : 'map',
      phase: battle ? (Math.random() > 0.5 ? 'attack' : 'defense') : 'move',
      side: battle ? (Math.random() > 0.5 ? 'self' : 'enemy') : undefined,
      confidence: Number((0.82 + Math.random() * 0.16).toFixed(2)),
      capturedAt: now,
      createdAt: now
    }
  }

  private createMockSteps(eventId: string, confidence: number): DiceValueStep[] {
    const base = Math.floor(Math.random() * 6) + 1
    const bonusCount = Math.random() > 0.55 ? Math.floor(Math.random() * 2) + 1 : 0
    const steps: DiceValueStep[] = [
      {
        id: randomUUID(),
        eventId,
        sequenceIndex: 0,
        sourceType: 'base',
        baseValue: base,
        previousValue: base,
        deltaValue: 0,
        finalValue: base,
        confidence
      }
    ]

    let previous = base

    for (let index = 1; index <= bonusCount; index += 1) {
      const delta = Math.floor(Math.random() * 4) + 1
      const finalValue = previous + delta

      steps.push({
        id: randomUUID(),
        eventId,
        sequenceIndex: index,
        sourceType: 'card_bonus',
        baseValue: base,
        previousValue: previous,
        deltaValue: delta,
        finalValue,
        cardIndex: index,
        confidence: Number(Math.max(0.78, confidence - index * 0.03).toFixed(2))
      })

      previous = finalValue
    }

    return steps
  }

  private createValueSteps(eventId: string, result: GameRecognitionResult): DiceValueStep[] {
    return [
      {
        id: randomUUID(),
        eventId,
        sequenceIndex: 0,
        sourceType: 'unknown',
        finalValue: result.value ?? 0,
        confidence: result.confidence
      }
    ]
  }
}
