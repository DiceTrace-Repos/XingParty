import { Badge, Button, Text } from '@fluentui/react-components'
import { Delete24Regular, Save24Regular } from '@fluentui/react-icons'
import { useTranslation } from 'react-i18next'
import type { AppLogEntry } from '../../../../shared/types'
import './RuntimeLogsPage.css'

interface RuntimeLogsPageProps {
  logs: AppLogEntry[]
  onClearLogs: () => void
  onExportLogs: () => void
}

function RuntimeLogsPage({
  logs,
  onClearLogs,
  onExportLogs
}: RuntimeLogsPageProps): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <section className="runtimeLogsPage">
      <div className="runtimeLogsHeader">
        <div>
          <Text size={600} weight="semibold">
            {t('logs.title')}
          </Text>
          <Text className="mutedText">{t('logs.subtitle')}</Text>
        </div>
        <div className="runtimeLogsActions">
          <Button appearance="subtle" icon={<Save24Regular />} onClick={onExportLogs}>
            {t('actions.exportLogs')}
          </Button>
          <Button appearance="subtle" icon={<Delete24Regular />} onClick={onClearLogs}>
            {t('actions.clearLogs')}
          </Button>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="runtimeLogsEmpty">
          <Text>{t('logs.empty')}</Text>
        </div>
      ) : (
        <div className="runtimeLogList">
          {logs.map((log) => (
            <div className="runtimeLogRow" key={log.id}>
              <div className="runtimeLogMeta">
                <Badge appearance="tint" color={getLogLevelColor(log.level)}>
                  {log.level.toUpperCase()}
                </Badge>
                <Text className="mutedText">{new Date(log.createdAt).toLocaleTimeString()}</Text>
                <Text className="monoText">{log.scope}</Text>
              </div>
              <Text>{log.message}</Text>
              {log.detail ? <pre className="runtimeLogDetail">{log.detail}</pre> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function getLogLevelColor(level: AppLogEntry['level']): 'informative' | 'warning' | 'danger' {
  switch (level) {
    case 'warn':
      return 'warning'
    case 'error':
      return 'danger'
    default:
      return 'informative'
  }
}

export default RuntimeLogsPage
