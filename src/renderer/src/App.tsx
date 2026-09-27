import { FluentProvider, webLightTheme } from '@fluentui/react-components'
import './i18n'
import GameShell from './layout/GameShell'

function App(): React.JSX.Element {
  return (
    <FluentProvider theme={webLightTheme}>
      <GameShell />
    </FluentProvider>
  )
}

export default App
