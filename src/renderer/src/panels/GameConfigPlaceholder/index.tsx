import { Text } from '@fluentui/react-components'
import { Settings24Regular } from '@fluentui/react-icons'
import { useTranslation } from 'react-i18next'
import './GameConfigPlaceholder.css'

function GameConfigPlaceholder(): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <aside className="configPanel">
      <div className="panelHeader">
        <div className="panelTitleWithIcon">
          <Settings24Regular />
          <Text weight="semibold">{t('config.title')}</Text>
        </div>
      </div>
      <div className="placeholderBlock">
        <Text size={500} weight="semibold">
          {t('config.placeholderTitle')}
        </Text>
        <Text className="mutedText">{t('config.placeholderBody')}</Text>
      </div>
    </aside>
  )
}

export default GameConfigPlaceholder
