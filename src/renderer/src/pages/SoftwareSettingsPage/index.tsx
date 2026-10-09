import { Button, Input, MessageBar, MessageBarBody, Switch, Text } from '@fluentui/react-components'
import { ArrowSync24Regular, FolderOpen24Regular, Settings24Regular } from '@fluentui/react-icons'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BootstrapState, ClientSettingsUpdate } from '../../../../shared/types'
import './SoftwareSettingsPage.css'

interface SoftwareSettingsPageProps {
  state: BootstrapState
  onSettingsChange: (update: ClientSettingsUpdate) => Promise<BootstrapState>
  onRefreshGameRoles: () => Promise<BootstrapState>
}

function SoftwareSettingsPage({
  state,
  onSettingsChange,
  onRefreshGameRoles
}: SoftwareSettingsPageProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const [gamePath, setGamePath] = useState(state.client.gamePath)
  const [autoShareData, setAutoShareData] = useState(state.client.autoShareData)
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<'success' | 'error'>()
  const [refreshingResource, setRefreshingResource] = useState(false)
  const [resourceResult, setResourceResult] = useState<'success' | 'error'>()
  const [resourceError, setResourceError] = useState<string>()

  useEffect(() => {
    if (!saveResult) {
      return
    }

    const timer = window.setTimeout(() => setSaveResult(undefined), 3000)
    return () => window.clearTimeout(timer)
  }, [saveResult])

  useEffect(() => {
    if (!resourceResult) {
      return
    }

    const timer = window.setTimeout(() => setResourceResult(undefined), 3000)
    return () => window.clearTimeout(timer)
  }, [resourceResult])

  const saveSettings = async (): Promise<void> => {
    const normalizedPath = gamePath.trim()
    setGamePath(normalizedPath)
    setSaving(true)
    setSaveResult(undefined)

    try {
      const nextState = await onSettingsChange({
        gamePath: normalizedPath,
        autoShareData
      })
      setGamePath(nextState.client.gamePath)
      setAutoShareData(nextState.client.autoShareData)
      setSaveResult('success')
    } catch {
      setSaveResult('error')
    } finally {
      setSaving(false)
    }
  }

  const selectGamePath = async (): Promise<void> => {
    const selectedPath = await window.api.selectGamePath(t('settings.gamePathDialogTitle'))

    if (selectedPath) {
      setGamePath(selectedPath)
      setSaveResult(undefined)
    }
  }

  const refreshGameRoles = async (): Promise<void> => {
    setRefreshingResource(true)
    setResourceResult(undefined)
    setResourceError(undefined)
    try {
      await onRefreshGameRoles()
      setResourceResult('success')
    } catch (error) {
      setResourceError(getErrorMessage(error))
      setResourceResult('error')
    } finally {
      setRefreshingResource(false)
    }
  }

  const lastResourceUpdate = state.gameRoleResource?.updatedAt
    ? new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
        dateStyle: 'medium',
        timeStyle: 'medium'
      }).format(new Date(state.gameRoleResource.updatedAt))
    : t('settings.resourceNeverUpdated')

  return (
    <section className="softwareSettingsPage">
      {saveResult || resourceResult ? (
        <MessageBar intent={saveResult ?? resourceResult} className="settingsSaveMessage">
          <MessageBarBody>
            {saveResult
              ? saveResult === 'success'
                ? t('settings.saveSuccess')
                : t('settings.saveError')
              : resourceResult === 'success'
                ? t('settings.resourceRefreshSuccess')
                : `${t('settings.resourceRefreshError')}：${resourceError ?? t('settings.unknownError')}`}
          </MessageBarBody>
        </MessageBar>
      ) : null}

      <div className="softwareSettingsHeader">
        <Settings24Regular />
        <div>
          <Text size={600} weight="semibold">
            {t('settings.title')}
          </Text>
        </div>
      </div>

      <div className="softwareSettingsContent">
        <div className="settingsList">
          <SettingRow
            label={t('settings.clientId')}
            description={t('settings.clientIdDescription')}
          >
            <Text className="clientIdValue">{state.client.clientId}</Text>
          </SettingRow>

          <SettingRow
            label={t('settings.gameRoleResource')}
            description={t('settings.gameRoleResourceDescription')}
          >
            <div className="resourceUpdateControl">
              <div className="resourceUpdateStatus">
                <Text size={200} className="mutedText">
                  {t('settings.lastResourceUpdate')}
                </Text>
                <Text>{lastResourceUpdate}</Text>
                {state.gameRoleResource ? (
                  <Text size={200} className="mutedText">
                    {t('settings.resourceVersion', {
                      version: state.gameRoleResource.version,
                      count: state.gameRoleResource.contents.length
                    })}
                  </Text>
                ) : null}
              </div>
              <Button
                icon={<ArrowSync24Regular />}
                disabled={refreshingResource}
                onClick={() => void refreshGameRoles()}
              >
                {refreshingResource
                  ? t('settings.refreshingResource')
                  : t('settings.refreshResource')}
              </Button>
            </div>
          </SettingRow>

          <SettingRow
            label={t('settings.gamePath')}
            description={t('settings.gamePathDescription')}
          >
            <div className="gamePathControl">
              <Input
                value={gamePath}
                placeholder={t('settings.gamePathPlaceholder')}
                aria-label={t('settings.gamePath')}
                onChange={(_, data) => {
                  setGamePath(data.value)
                  setSaveResult(undefined)
                }}
              />
              <Button icon={<FolderOpen24Regular />} onClick={() => void selectGamePath()}>
                {t('settings.browse')}
              </Button>
            </div>
          </SettingRow>

          <SettingRow
            label={t('settings.autoShareData')}
            description={t('settings.autoShareDataDescription')}
          >
            <Switch
              checked={autoShareData}
              aria-label={t('settings.autoShareData')}
              label={autoShareData ? t('settings.switchOn') : t('settings.switchOff')}
              onChange={(_, data) => {
                setAutoShareData(data.checked)
                setSaveResult(undefined)
              }}
            />
          </SettingRow>
        </div>

        <div className="settingsFooter">
          <Button appearance="primary" disabled={saving} onClick={() => void saveSettings()}>
            {saving ? t('settings.saving') : t('settings.save')}
          </Button>
        </div>
      </div>
    </section>
  )
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace(/^Error invoking remote method '[^']+': Error: /, '')
  }
  return String(error)
}

function SettingRow({
  label,
  description,
  children
}: {
  label: string
  description: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="settingsRow">
      <div className="settingsRowText">
        <Text weight="semibold">{label}</Text>
        <Text size={200} className="mutedText">
          {description}
        </Text>
      </div>
      <div className="settingsRowControl">{children}</div>
    </div>
  )
}

export default SoftwareSettingsPage
