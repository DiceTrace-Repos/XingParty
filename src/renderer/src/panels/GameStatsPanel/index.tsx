import {
  Avatar,
  Badge,
  Button,
  MessageBar,
  MessageBarBody,
  Select,
  Tab,
  TabList,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text
} from '@fluentui/react-components'
import {
  ArrowClockwise24Regular,
  ArrowSortDown16Regular,
  ArrowSortUp16Regular,
  ChevronLeft16Regular,
  ChevronRight16Regular,
  DocumentArrowUp24Regular,
  Play24Regular,
  Stop24Regular
} from '@fluentui/react-icons'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  BootstrapState,
  DiceEventSourceType,
  DiceStatistics,
  DiceStatisticsEntry,
  GameRoleResourceItem
} from '../../../../shared/types'
import './GameStatsPanel.css'

const ALL = 'all'
const PAGE_SIZES = [4, 6, 8, 10]

type PrimaryTab = 'move' | 'battle'
type BattleTab = 'base' | 'card'
type SortDirection = 'ascending' | 'descending'

interface SortState {
  value: number
  direction: SortDirection
}

interface RoleStatistics {
  gameRole: string
  counts: number[]
  defaultIndex: number
}

interface GameStatsPanelProps {
  state: BootstrapState
  gameName: string
  recognitionError?: string
  onRefresh: () => void
  onStartRecognition: () => void
  onUploadVideo: () => void
  onStop: () => void
}

interface DiceMatrixProps {
  rows: RoleStatistics[]
  roles: GameRoleResourceItem[]
  maxValue: number
  page: number
  pageSize: number
  sort?: SortState
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  onSortChange: (sort?: SortState) => void
}

function GameStatsPanel({
  state,
  gameName,
  recognitionError,
  onRefresh,
  onStartRecognition,
  onUploadVideo,
  onStop
}: GameStatsPanelProps): React.JSX.Element {
  const { t } = useTranslation()
  const [primaryTab, setPrimaryTab] = useState<PrimaryTab>('move')
  const [battleTab, setBattleTab] = useState<BattleTab>('base')
  const [sessionId, setSessionId] = useState(ALL)
  const [roundId, setRoundId] = useState(ALL)
  const [sort, setSort] = useState<SortState>()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(4)
  const statistics = state.diceStatistics ?? EMPTY_STATISTICS
  const availableRounds = useMemo(
    () =>
      sessionId === ALL ? [] : statistics.rounds.filter((round) => round.sessionId === sessionId),
    [sessionId, statistics.rounds]
  )
  const sourceType: DiceEventSourceType = primaryTab === 'move' ? 'map' : 'raw'
  const maxValue = primaryTab === 'move' ? 10 : 6
  const rows = useMemo(
    () => buildRoleStatistics(statistics.entries, sourceType, maxValue, sessionId, roundId),
    [maxValue, roundId, sessionId, sourceType, statistics.entries]
  )

  const resetTableView = (): void => {
    setSort(undefined)
    setPage(1)
  }

  return (
    <section className="statsPanel">
      <div className="gamePanelTabs">
        <Text size={600} weight="semibold">
          {t('gamePanel.info')}
        </Text>
        <div className="panelActions">
          <div className="toolbar">
            <Button
              appearance="subtle"
              icon={<ArrowClockwise24Regular />}
              aria-label={t('actions.refresh')}
              onClick={onRefresh}
            />
            {state.recognitionRunning ? (
              <Button appearance="primary" icon={<Stop24Regular />} onClick={onStop}>
                {t('actions.stop')}
              </Button>
            ) : (
              <>
                <Button appearance="primary" icon={<Play24Regular />} onClick={onStartRecognition}>
                  {t('actions.startRecognition')}
                </Button>
                <Button icon={<DocumentArrowUp24Regular />} onClick={onUploadVideo}>
                  {t('actions.uploadVideo')}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="gameSummary">
        <div>
          <Text size={700} weight="semibold" block>
            {gameName}
          </Text>
          <Text size={200} className="mutedText">
            {t('stats.diceStatisticsDescription')}
          </Text>
        </div>
        <Badge appearance="tint" color={state.recognitionRunning ? 'success' : 'subtle'}>
          {state.recognitionRunning ? t('status.running') : t('status.stopped')}
        </Badge>
      </div>

      {recognitionError ? (
        <MessageBar intent="error">
          <MessageBarBody>{recognitionError}</MessageBarBody>
        </MessageBar>
      ) : null}

      <TabList
        selectedValue={primaryTab}
        onTabSelect={(_, data) => {
          setPrimaryTab(String(data.value) as PrimaryTab)
          resetTableView()
        }}
      >
        <Tab value="move">{t('stats.moveDice')}</Tab>
        <Tab value="battle">{t('stats.battleDice')}</Tab>
      </TabList>

      <div className="statsFilters">
        <label className="statsFilter">
          <Text size={200}>{t('stats.session')}</Text>
          <Select
            value={sessionId}
            onChange={(event) => {
              setSessionId(event.target.value)
              setRoundId(ALL)
              resetTableView()
            }}
          >
            <option value={ALL}>{t('stats.allSessions')}</option>
            {statistics.sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {formatSession(session.startedAt, session.id)}
              </option>
            ))}
          </Select>
        </label>
        <label className="statsFilter">
          <Text size={200}>{t('stats.round')}</Text>
          <Select
            value={roundId}
            disabled={sessionId === ALL}
            onChange={(event) => {
              setRoundId(event.target.value)
              resetTableView()
            }}
          >
            <option value={ALL}>{t('stats.allRounds')}</option>
            {availableRounds.map((round) => (
              <option key={round.id} value={round.id}>
                {t('stats.roundNumber', { value: round.roundIndex })}
              </option>
            ))}
          </Select>
        </label>
        <Text size={200} className="statsScopeSummary">
          {t('stats.scopeSummary', {
            sessions: statistics.sessions.length,
            rounds: statistics.rounds.length,
            rolls: countEntries(statistics.entries, sessionId, roundId)
          })}
        </Text>
      </div>

      {primaryTab === 'battle' ? (
        <TabList
          appearance="subtle"
          selectedValue={battleTab}
          onTabSelect={(_, data) => {
            setBattleTab(String(data.value) as BattleTab)
            resetTableView()
          }}
        >
          <Tab value="base">{t('stats.baseDice')}</Tab>
          <Tab value="card">{t('stats.cardDice')}</Tab>
        </TabList>
      ) : null}

      {primaryTab === 'battle' && battleTab === 'card' ? (
        <div className="statsPlaceholder">
          <Text>{t('stats.cardDicePending')}</Text>
        </div>
      ) : (
        <DiceMatrix
          rows={rows}
          roles={state.gameRoleResource?.contents ?? []}
          maxValue={maxValue}
          page={page}
          pageSize={pageSize}
          sort={sort}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize)
            setPage(1)
          }}
          onSortChange={(nextSort) => {
            setSort(nextSort)
            setPage(1)
          }}
        />
      )}
    </section>
  )
}

function DiceMatrix({
  rows,
  roles,
  maxValue,
  page,
  pageSize,
  sort,
  onPageChange,
  onPageSizeChange,
  onSortChange
}: DiceMatrixProps): React.JSX.Element {
  const { t } = useTranslation()
  const rolesById = useMemo(() => new Map(roles.map((role) => [role.game_id, role])), [roles])
  const sortedRows = useMemo(() => {
    const nextRows = [...rows]
    if (!sort) {
      return nextRows
    }

    return nextRows.sort((left, right) => {
      const difference = left.counts[sort.value - 1] - right.counts[sort.value - 1]
      if (difference === 0) {
        return left.defaultIndex - right.defaultIndex
      }
      return sort.direction === 'ascending' ? difference : -difference
    })
  }, [rows, sort])
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * pageSize
  const visibleRows = sortedRows.slice(pageStart, pageStart + pageSize)
  const maxCount = Math.max(0, ...rows.flatMap((row) => row.counts))
  const values = Array.from({ length: maxValue }, (_, index) => index + 1)
  const roleColumnPercent = maxValue === 10 ? 24 : 28
  const valueColumnPercent = (100 - roleColumnPercent) / maxValue
  const sortedColumnStyle = sort
    ? {
        left: `${roleColumnPercent + valueColumnPercent * (sort.value - 1)}%`,
        width: `${valueColumnPercent}%`
      }
    : undefined

  const cycleSort = (value: number): void => {
    if (!sort || sort.value !== value) {
      onSortChange({ value, direction: 'descending' })
    } else if (sort.direction === 'descending') {
      onSortChange({ value, direction: 'ascending' })
    } else {
      onSortChange(undefined)
    }
  }

  return (
    <div className="diceMatrixSection">
      <div className="matrixHeading">
        <Text weight="semibold">
          {maxValue === 10 ? t('stats.moveDiceMatrix') : t('stats.baseDiceMatrix')}
        </Text>
      </div>

      <div className="diceMatrixViewport">
        <div
          className={`diceMatrixStage ${maxValue === 6 ? 'diceMatrixStageCompact' : ''}`}
          style={{ height: 42 + pageSize * 48 }}
        >
          {sort ? <div className="sortedColumnBand" style={sortedColumnStyle} /> : null}
          <Table className="diceMatrix" aria-label={t('stats.diceMatrixAriaLabel')}>
            <colgroup>
              <col style={{ width: `${roleColumnPercent}%` }} />
              {values.map((value) => (
                <col key={value} style={{ width: `${valueColumnPercent}%` }} />
              ))}
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>{t('stats.roleAndValue')}</TableHeaderCell>
                {values.map((value) => {
                  const direction = sort?.value === value ? sort.direction : undefined
                  return (
                    <TableHeaderCell key={value} aria-sort={direction ?? 'none'}>
                      <Button
                        appearance="transparent"
                        size="small"
                        className="matrixSortButton"
                        aria-label={t('stats.sortValue', { value })}
                        onClick={() => cycleSort(value)}
                      >
                        <span>{value}</span>
                        <span className="matrixSortIcon" aria-hidden="true">
                          {direction === 'descending' ? (
                            <ArrowSortDown16Regular />
                          ) : direction === 'ascending' ? (
                            <ArrowSortUp16Regular />
                          ) : null}
                        </span>
                      </Button>
                    </TableHeaderCell>
                  )
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) => (
                <TableRow key={row.gameRole}>
                  <TableCell className="roleCell">
                    <RoleIdentity gameRole={row.gameRole} role={rolesById.get(row.gameRole)} />
                  </TableCell>
                  {row.counts.map((count, index) => (
                    <TableCell
                      key={index}
                      className="countCell"
                      data-level={getCountLevel(count, maxCount)}
                    >
                      {count}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {visibleRows.length === 0 ? (
            <div className="matrixEmptyState">
              <Text>{t('stats.emptyStatistics')}</Text>
            </div>
          ) : null}
        </div>
      </div>

      <div className="matrixFooter">
        <div className="paginationControls">
          <label className="pageSizeControl">
            <Text size={200}>{t('stats.rowsPerPage')}</Text>
            <Select
              value={String(pageSize)}
              size="small"
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {t('stats.rowsCount', { value: size })}
                </option>
              ))}
            </Select>
          </label>
          <Button
            appearance="subtle"
            size="small"
            icon={<ChevronLeft16Regular />}
            aria-label={t('stats.previousPage')}
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
          />
          <Text size={200}>
            {t('stats.pageSummary', {
              page: currentPage,
              pages: totalPages,
              roles: sortedRows.length
            })}
          </Text>
          <Button
            appearance="subtle"
            size="small"
            icon={<ChevronRight16Regular />}
            aria-label={t('stats.nextPage')}
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          />
        </div>
        <div className="countLegend" aria-label={t('stats.frequencyLegend')}>
          <Text size={100}>{t('stats.frequencyLow')}</Text>
          <span className="countLegendSwatch" data-level="1" />
          <span className="countLegendSwatch" data-level="3" />
          <span className="countLegendSwatch" data-level="4" />
          <Text size={100}>{t('stats.frequencyHigh')}</Text>
        </div>
      </div>
    </div>
  )
}

function RoleIdentity({
  gameRole,
  role
}: {
  gameRole: string
  role?: GameRoleResourceItem
}): React.JSX.Element {
  const displayName = role?.name.trim() || gameRole
  const avatar = role?.avatar?.trim()

  return (
    <div className="roleIdentity" title={role?.name || gameRole}>
      <Avatar size={28} name={displayName} image={avatar ? { src: avatar } : undefined} />
      <Text className="roleName">{displayName}</Text>
    </div>
  )
}

const EMPTY_STATISTICS: DiceStatistics = { sessions: [], rounds: [], entries: [] }

function buildRoleStatistics(
  entries: DiceStatisticsEntry[],
  sourceType: DiceEventSourceType,
  maxValue: number,
  sessionId: string,
  roundId: string
): RoleStatistics[] {
  const countsByRole = new Map<string, number[]>()

  for (const entry of entries) {
    if (
      entry.type !== sourceType ||
      entry.value < 1 ||
      entry.value > maxValue ||
      (sessionId !== ALL && entry.sessionId !== sessionId) ||
      (roundId !== ALL && entry.roundId !== roundId)
    ) {
      continue
    }

    const counts = countsByRole.get(entry.gameRole) ?? Array.from({ length: maxValue }, () => 0)
    counts[entry.value - 1] += entry.count
    countsByRole.set(entry.gameRole, counts)
  }

  return [...countsByRole.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([gameRole, counts], defaultIndex) => ({ gameRole, counts, defaultIndex }))
}

function countEntries(entries: DiceStatisticsEntry[], sessionId: string, roundId: string): number {
  return entries.reduce((total, entry) => {
    if (
      (sessionId === ALL || entry.sessionId === sessionId) &&
      (roundId === ALL || entry.roundId === roundId)
    ) {
      return total + entry.count
    }
    return total
  }, 0)
}

function getCountLevel(count: number, maxCount: number): number {
  if (count === 0 || maxCount === 0) {
    return 0
  }
  return Math.max(1, Math.min(4, Math.ceil((count / maxCount) * 4)))
}

function formatSession(startedAt: string, id: string): string {
  const timestamp = new Date(startedAt).toLocaleString(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
  return `${timestamp} · ${id.slice(0, 8)}`
}

export default GameStatsPanel
