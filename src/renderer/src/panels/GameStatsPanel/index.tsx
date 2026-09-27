import {
  Button,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  TableColumnDefinition,
  Text,
  createTableColumn
} from '@fluentui/react-components'
import {
  ArrowClockwise24Regular,
  DocumentArrowUp24Regular,
  Play24Regular,
  Stop24Regular
} from '@fluentui/react-icons'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { BootstrapState, RecentDiceEvent } from '../../../../shared/types'
import './GameStatsPanel.css'

interface GameStatsPanelProps {
  state: BootstrapState
  gameName: string
  recognitionError?: string
  onRefresh: () => void
  onStartRecognition: () => void
  onUploadVideo: () => void
  onStop: () => void
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
  const columns = useMemo<TableColumnDefinition<RecentDiceEvent>[]>(
    () => [
      createTableColumn<RecentDiceEvent>({
        columnId: 'scene',
        renderHeaderCell: () => t('stats.scene'),
        renderCell: (item) => t(`scene.${item.scene}`)
      }),
      createTableColumn<RecentDiceEvent>({
        columnId: 'phase',
        renderHeaderCell: () => t('stats.phase'),
        renderCell: (item) => t(`phase.${item.phase}`)
      }),
      createTableColumn<RecentDiceEvent>({
        columnId: 'side',
        renderHeaderCell: () => t('stats.side'),
        renderCell: (item) => t(`side.${item.side ?? 'none'}`)
      }),
      createTableColumn<RecentDiceEvent>({
        columnId: 'finalValue',
        renderHeaderCell: () => t('stats.finalValue'),
        renderCell: (item) => item.finalValue
      }),
      createTableColumn<RecentDiceEvent>({
        columnId: 'stepCount',
        renderHeaderCell: () => t('stats.stepCount'),
        renderCell: (item) => item.stepCount
      }),
      createTableColumn<RecentDiceEvent>({
        columnId: 'confidence',
        renderHeaderCell: () => t('stats.confidence'),
        renderCell: (item) => `${Math.round(item.confidence * 100)}%`
      }),
      createTableColumn<RecentDiceEvent>({
        columnId: 'capturedAt',
        renderHeaderCell: () => t('stats.capturedAt'),
        renderCell: (item) => new Date(item.capturedAt).toLocaleTimeString()
      })
    ],
    [t]
  )

  return (
    <section className="statsPanel">
      <div className="gamePanelTabs">
        <Text size={600} weight="semibold">
          {t('gamePanel.info')}
        </Text>
        <div className="panelActions">
          <div className="toolbar">
            <Button appearance="subtle" icon={<ArrowClockwise24Regular />} onClick={onRefresh} />
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

      <>
        <div className="gameSummary">
          <Text size={700} weight="semibold">
            {gameName}
          </Text>
          <Text
            className={state.recognitionRunning ? 'statusText statusTextRunning' : 'statusText'}
          >
            {state.recognitionRunning ? t('status.running') : t('status.stopped')}
          </Text>
        </div>

        {recognitionError ? (
          <div className="errorMessage">
            <Text>{recognitionError}</Text>
          </div>
        ) : null}

        <div className="sectionHeader">
          <Text weight="semibold">{t('stats.recentEvents')}</Text>
        </div>

        {state.recentEvents.length === 0 ? (
          <div className="emptyState">
            <Text>{t('stats.emptyEvents')}</Text>
          </div>
        ) : (
          <DataGrid items={state.recentEvents} columns={columns} className="eventsGrid">
            <DataGridHeader>
              <DataGridRow>
                {({ renderHeaderCell }) => (
                  <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>
                )}
              </DataGridRow>
            </DataGridHeader>
            <DataGridBody<RecentDiceEvent>>
              {({ item, rowId }) => (
                <DataGridRow<RecentDiceEvent> key={rowId}>
                  {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
                </DataGridRow>
              )}
            </DataGridBody>
          </DataGrid>
        )}
      </>
    </section>
  )
}

export default GameStatsPanel
