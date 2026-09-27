import { Text } from '@fluentui/react-components'
import { Settings24Regular } from '@fluentui/react-icons'
import { useTranslation } from 'react-i18next'
import type { BootstrapState, StoredGame } from '../../../../shared/types'
import GameConfigPlaceholder from '../../panels/GameConfigPlaceholder'
import './SoftwareSettingsPage.css'

interface SoftwareSettingsPageProps {
  state: BootstrapState
  activeGame?: StoredGame
}

function SoftwareSettingsPage({ state, activeGame }: SoftwareSettingsPageProps): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <section className="softwareSettingsPage">
      <div className="softwareSettingsHeader">
        <Settings24Regular />
        <div>
          <Text size={600} weight="semibold">
            {t('settings.title')}
          </Text>
          <Text className="mutedText">{t('settings.subtitle')}</Text>
        </div>
      </div>

      <div className="softwareSettingsContent">
        <div className="readonlyMetaGrid">
          <Meta label={t('stats.clientId')} value={state.client.clientId} />
          <Meta label={t('stats.gameId')} value={activeGame?.id ?? '-'} />
          <Meta label={t('stats.gameKey')} value={activeGame?.key ?? '-'} />
        </div>
        <GameConfigPlaceholder />
      </div>
    </section>
  )
}

function Meta({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="metaItem">
      <Text className="mutedText">{label}</Text>
      <Text className="monoText">{value}</Text>
    </div>
  )
}

export default SoftwareSettingsPage
