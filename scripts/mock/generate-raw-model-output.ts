import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  ModelLabel,
  RawModelFrame,
  RawModelOutputFixture,
  RawPrediction
} from '../../src/shared/raw-model-output'

const API_URL = 'http://localhost:8000/api/v1/game-roles'
const WIDTH = 1920
const HEIGHT = 1080

interface GameRoleResponse {
  game_id?: string | null
}

interface GameRolesResponse {
  version: string
  contents: GameRoleResponse[]
}

interface CliOptions {
  apiUrl: string
  seed: number
  output: string
}

class SeededRandom {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0
  }

  next(): number {
    this.state += 0x6d2b79f5
    let value = this.state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }

  integer(minimum: number, maximum: number): number {
    return minimum + Math.floor(this.next() * (maximum - minimum + 1))
  }

  choice<T>(items: readonly T[]): T {
    const item = items[this.integer(0, items.length - 1)]
    if (item === undefined) {
      throw new Error('Cannot choose from an empty collection')
    }
    return item
  }

  sample<T>(items: readonly T[], count: number): T[] {
    const copy = [...items]
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const target = this.integer(0, index)
      ;[copy[index], copy[target]] = [copy[target] as T, copy[index] as T]
    }
    return copy.slice(0, count)
  }
}

function detectionId(...parts: Array<string | number>): string {
  return parts.join('-')
}

function prediction(
  id: string,
  label: ModelLabel,
  bbox: [number, number, number, number],
  attributes: Record<string, string | number>,
  random: SeededRandom
): RawPrediction {
  return {
    detectionId: id,
    label,
    confidence: Number((0.82 + random.next() * 0.175).toFixed(4)),
    bbox,
    attributes
  }
}

function createFrame(
  frameId: string,
  frameNumber: number,
  capturedAt: Date,
  predictions: RawPrediction[]
): RawModelFrame {
  return {
    frameId,
    frameNumber,
    capturedAt: capturedAt.toISOString(),
    image: { width: WIDTH, height: HEIGHT },
    predictions
  }
}

function mapPredictions(
  frameId: string,
  roundIndex: number,
  roleId: string,
  random: SeededRandom
): RawPrediction[] {
  const result: RawPrediction[] = []
  const maximum = Math.min(roundIndex + 5, 20)
  let index = 0

  for (let value = roundIndex; value <= maximum; value += 1) {
    const attributeValue =
      frameId.endsWith('04') && index === 5 ? '-1' : random.next() < 0.04 ? 'null' : String(value)
    result.push(
      prediction(
        detectionId(frameId, 'round', index),
        'round_slot',
        [650 + index * 100, 25, 735 + index * 100, 75],
        { value: attributeValue, index },
        random
      )
    )
    index += 1
  }

  const dieCount = random.integer(1, 2)
  for (let dieIndex = 0; dieIndex < dieCount; dieIndex += 1) {
    result.push(
      prediction(
        detectionId(frameId, 'die', dieIndex),
        'board_die',
        [650 + dieIndex * 340, 175, 920 + dieIndex * 340, 455],
        {
          index: dieIndex,
          value: random.next() < 0.08 ? 'null' : String(random.integer(1, 10))
        },
        random
      )
    )
  }

  result.push(
    prediction(
      detectionId(frameId, 'character'),
      'map_character',
      [870, 410, 1080, 760],
      { value: roleId },
      random
    )
  )
  return result
}

function boxes(side: 'left' | 'right'): Record<string, [number, number, number, number]> {
  if (side === 'left') {
    return {
      character: [360, 250, 780, 820],
      head: [470, 100, 660, 245],
      dice: [25, 820, 175, 900],
      point: [130, 850, 205, 940]
    }
  }
  return {
    character: [1110, 250, 1530, 820],
    head: [1160, 100, 1350, 245],
    dice: [1745, 820, 1895, 900],
    point: [1705, 850, 1780, 940]
  }
}

function shifted(
  source: [number, number, number, number],
  index: number,
  side: 'left' | 'right'
): [number, number, number, number] {
  const offset = index * 72 * (side === 'left' ? 1 : -1)
  return [source[0] + offset, source[1], source[2] + offset, source[3]]
}

function battleSidePredictions(
  frameId: string,
  side: 'left' | 'right',
  gameId: string,
  isRole: boolean,
  roleSide: 'left' | 'right',
  random: SeededRandom
): RawPrediction[] {
  const area = boxes(side)
  const result: RawPrediction[] = [
    prediction(
      detectionId(frameId, side, 'character'),
      'battle_character',
      area.character as [number, number, number, number],
      { value: gameId, side },
      random
    ),
    prediction(
      detectionId(frameId, side, 'head'),
      'player_head_count',
      area.head as [number, number, number, number],
      {
        value: random.next() < 0.05 ? 'null' : String(random.integer(1, 30)),
        side
      },
      random
    )
  ]

  const cardCount = isRole ? random.integer(0, 2) : 0
  const diceMaximum = isRole ? (roleSide === 'left' ? 30 : 15) : 10

  for (let index = 0; index < cardCount + 1; index += 1) {
    result.push(
      prediction(
        detectionId(frameId, side, 'dice', index),
        'card_dice_value',
        shifted(area.dice as [number, number, number, number], index, side),
        { value: random.integer(1, diceMaximum), index, side },
        random
      )
    )
  }

  for (let index = 0; index < cardCount; index += 1) {
    result.push(
      prediction(
        detectionId(frameId, side, 'point', index),
        'card_point_value',
        shifted(area.point as [number, number, number, number], index, side),
        { value: String(random.integer(1, 4)), index, side },
        random
      )
    )
  }
  return result
}

function battlePredictions(
  frameId: string,
  roleSide: 'left' | 'right',
  roleId: string,
  monsterId: string,
  random: SeededRandom
): RawPrediction[] {
  const monsterSide = roleSide === 'left' ? 'right' : 'left'
  const ids: Record<'left' | 'right', string> = {
    [roleSide]: roleId,
    [monsterSide]: monsterId
  } as Record<'left' | 'right', string>
  return (['left', 'right'] as const).flatMap((side) =>
    battleSidePredictions(frameId, side, ids[side], side === roleSide, roleSide, random)
  )
}

export function extractRolePools(snapshot: GameRolesResponse): {
  roles: string[]
  monsters: string[]
} {
  const roles: string[] = []
  const monsters: string[] = []

  for (const item of snapshot.contents) {
    const gameId = Number(item.game_id)
    if (!Number.isInteger(gameId)) {
      continue
    }
    if (gameId >= 100 && gameId <= 200) {
      roles.push(String(gameId))
    } else if (gameId > 1000) {
      monsters.push(String(gameId))
    }
  }

  if (roles.length < 4 || monsters.length === 0) {
    throw new Error('game-roles needs four IDs in 100..200 and one ID above 1000')
  }
  return { roles, monsters }
}

export function generateRawModelOutput(
  snapshot: GameRolesResponse,
  seed: number
): RawModelOutputFixture {
  const { roles, monsters } = extractRolePools(snapshot)
  const random = new SeededRandom(seed)
  const frames: RawModelFrame[] = []
  let capturedAt = new Date('2026-10-06T00:00:00.000Z')

  for (let roundIndex = 1; roundIndex <= 8; roundIndex += 1) {
    const mapRoles = random.sample(roles, 4)
    mapRoles.forEach((roleId, roleIndex) => {
      const eventSequence = roleIndex + 1
      const frameId = detectionId(
        'round',
        String(roundIndex).padStart(2, '0'),
        'map',
        String(eventSequence).padStart(2, '0')
      )
      frames.push(
        createFrame(
          frameId,
          frames.length,
          capturedAt,
          mapPredictions(frameId, roundIndex, roleId, random)
        )
      )
      capturedAt = new Date(capturedAt.getTime() + 3000)
    })

    let battleSequence = 0
    for (const roleSide of ['left', 'right'] as const) {
      const battleCount = random.integer(1, 2)
      for (let index = 0; index < battleCount; index += 1) {
        battleSequence += 1
        const frameId = detectionId(
          'round',
          String(roundIndex).padStart(2, '0'),
          'battle',
          String(battleSequence).padStart(2, '0')
        )
        frames.push(
          createFrame(
            frameId,
            frames.length,
            capturedAt,
            battlePredictions(
              frameId,
              roleSide,
              random.choice(roles),
              random.choice(monsters),
              random
            )
          )
        )
        capturedAt = new Date(capturedAt.getTime() + 3000)
      }
    }
  }

  return {
    schemaVersion: 2,
    model: { name: 'lucky-party-detector', version: 'mock-1' },
    roleSnapshotVersion: snapshot.version,
    generatedAt: new Date().toISOString(),
    frames
  }
}

function attribute(item: RawPrediction, name: string): string | number {
  const value = item.attributes[name]
  if (value === undefined) {
    throw new Error('Missing attribute ' + name + ' on ' + item.detectionId)
  }
  return value
}

export function validateRawModelOutput(output: RawModelOutputFixture): void {
  for (let roundIndex = 1; roundIndex <= 8; roundIndex += 1) {
    const roundPrefix = `round-${String(roundIndex).padStart(2, '0')}-`
    const current = output.frames.filter((item) => item.frameId.startsWith(roundPrefix))
    const maps = current.filter((item) =>
      item.predictions.some((prediction) => prediction.label === 'map_character')
    )
    const battles = current.filter((item) =>
      item.predictions.some((prediction) => prediction.label === 'battle_character')
    )
    if (maps.length !== 4) {
      throw new Error('Each round must contain exactly four map frames')
    }

    const roleIds = maps.map((item) =>
      attribute(
        item.predictions.find(
          (prediction) => prediction.label === 'map_character'
        ) as RawPrediction,
        'value'
      )
    )
    if (
      new Set(roleIds).size !== 4 ||
      roleIds.some((value) => Number(value) < 100 || Number(value) > 200)
    ) {
      throw new Error('Map role IDs must be four distinct values in 100..200')
    }

    const sideCounts = { left: 0, right: 0 }
    for (const battle of battles) {
      const characters = battle.predictions.filter((item) => item.label === 'battle_character')
      const role = characters.find((item) => Number(attribute(item, 'value')) < 1000)
      const monster = characters.find((item) => Number(attribute(item, 'value')) > 1000)
      if (!role || !monster) {
        throw new Error('Each battle needs one role and one monster')
      }
      const roleSide = String(attribute(role, 'side')) as 'left' | 'right'
      sideCounts[roleSide] += 1
      if (attribute(monster, 'side') === roleSide) {
        throw new Error('Role and monster must occupy opposite sides')
      }

      for (const side of ['left', 'right'] as const) {
        const dice = battle.predictions.filter(
          (item) => item.label === 'card_dice_value' && attribute(item, 'side') === side
        )
        const points = battle.predictions.filter(
          (item) => item.label === 'card_point_value' && attribute(item, 'side') === side
        )
        if (dice.length < 1 || points.length !== dice.length - 1) {
          throw new Error('Card points must contain one fewer item than card dice')
        }
        if (
          points.some(
            (item) => Number(attribute(item, 'value')) < 1 || Number(attribute(item, 'value')) > 4
          )
        ) {
          throw new Error('Card point values must be in 1..4')
        }
        if (side === roleSide) {
          const maximum = roleSide === 'left' ? 30 : 15
          if (
            dice.some(
              (item) =>
                Number(attribute(item, 'value')) < 1 || Number(attribute(item, 'value')) > maximum
            )
          ) {
            throw new Error('Role dice value is outside the configured side range')
          }
        }
      }
    }
    if (
      sideCounts.left < 1 ||
      sideCounts.left > 2 ||
      sideCounts.right < 1 ||
      sideCounts.right > 2
    ) {
      throw new Error('Each round needs one or two battles for each role side')
    }
  }
}

async function loadSnapshot(apiUrl: string): Promise<GameRolesResponse> {
  const response = await fetch(apiUrl, { signal: AbortSignal.timeout(10_000) })
  if (!response.ok) {
    throw new Error('Unable to load game roles: HTTP ' + response.status)
  }
  const result = (await response.json()) as Partial<GameRolesResponse>
  if (typeof result.version !== 'string' || !Array.isArray(result.contents)) {
    throw new Error('game-roles response must contain version and contents')
  }
  return result as GameRolesResponse
}

function parseOptions(argumentsList: string[]): CliOptions {
  const options: CliOptions = {
    apiUrl: API_URL,
    seed: 20261006,
    output: 'resources/mock/recognition/raw-model-output.json'
  }
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index]
    const value = argumentsList[index + 1]
    if (argument === '--api-url' && value) {
      options.apiUrl = value
      index += 1
    } else if (argument === '--seed' && value) {
      options.seed = Number(value)
      index += 1
    } else if (argument === '--output' && value) {
      options.output = value
      index += 1
    } else {
      throw new Error('Unknown or incomplete argument: ' + argument)
    }
  }
  if (!Number.isInteger(options.seed)) {
    throw new Error('--seed must be an integer')
  }
  return options
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2))
  const output = generateRawModelOutput(await loadSnapshot(options.apiUrl), options.seed)
  validateRawModelOutput(output)
  const outputPath = resolve(options.output)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, JSON.stringify(output, null, 2) + '\n', 'utf8')
  console.log(outputPath)
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
