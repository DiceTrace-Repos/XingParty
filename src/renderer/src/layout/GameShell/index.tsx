import { Button, Image, Spinner, Tab, TabList, Tooltip } from '@fluentui/react-components'
import { DocumentBulletList24Regular, Settings24Regular } from '@fluentui/react-icons'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getGameMeta } from '../../../../shared/game-meta'
import type { AppLogEntry, BootstrapState, StoredGame } from '../../../../shared/types'
import { GAME_LOGOS } from '../../game-assets'
import RuntimeLogsPage from '../../pages/RuntimeLogsPage'
import SoftwareSettingsPage from '../../pages/SoftwareSettingsPage'
import GameStatsPanel from '../../panels/GameStatsPanel'
import './GameShell.css'

const SETTINGS_VIEW = 'software-settings'
const LOGS_VIEW = 'runtime-logs'

function GameShell(): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const [state, setState] = useState<BootstrapState>()
  const [activeView, setActiveView] = useState<string>()
  const [recognitionError, setRecognitionError] = useState<string>()
  const [logs, setLogs] = useState<AppLogEntry[]>([])
  const captureStreamRef = useRef<MediaStream | null>(null)
  const captureVideoRef = useRef<HTMLVideoElement | null>(null)
  const videoObjectUrlRef = useRef<string | null>(null)
  const captureTimerRef = useRef<number | null>(null)
  const captureInFlightRef = useRef(false)
  const videoInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let mounted = true

    window.api.getBootstrapState().then(async (nextState) => {
      if (!mounted) {
        return
      }

      setState(nextState)
      setActiveView((current) => current ?? nextState.activeGame?.key ?? LOGS_VIEW)
      setLogs(await window.api.getAppLogs())
      await i18n.changeLanguage(nextState.client.locale)
    })

    return () => {
      mounted = false
    }
  }, [i18n])

  useEffect(() => {
    const timer = window.setInterval(() => {
      window.api.getBootstrapState().then(setState)
      window.api.getAppLogs().then(setLogs)
    }, 1800)

    return () => window.clearInterval(timer)
  }, [])

  const activeGame = state?.activeGame
  const gameName = useMemo(() => getDisplayName(activeGame, t), [activeGame, t])

  const stopLocalCapture = useCallback((): void => {
    if (captureTimerRef.current) {
      window.clearInterval(captureTimerRef.current)
      captureTimerRef.current = null
    }

    captureStreamRef.current?.getTracks().forEach((track) => track.stop())
    captureStreamRef.current = null
    if (captureVideoRef.current) {
      captureVideoRef.current.pause()
      captureVideoRef.current.src = ''
      captureVideoRef.current = null
    }
    if (videoObjectUrlRef.current) {
      URL.revokeObjectURL(videoObjectUrlRef.current)
      videoObjectUrlRef.current = null
    }
    captureInFlightRef.current = false
  }, [])

  useEffect(() => {
    return () => stopLocalCapture()
  }, [stopLocalCapture])

  const refresh = async (): Promise<void> => {
    setState(await window.api.refreshGameCatalog())
    setLogs(await window.api.getAppLogs())
  }

  const clearLogs = async (): Promise<void> => {
    setLogs(await window.api.clearAppLogs())
  }

  const exportLogs = async (): Promise<void> => {
    await window.api.exportAppLogs()
    setLogs(await window.api.getAppLogs())
  }

  const startRecognition = async (): Promise<void> => {
    if (!activeGame) {
      return
    }

    stopLocalCapture()
    setRecognitionError(undefined)

    try {
      if (typeof window.api.startRecognition !== 'function') {
        throw new Error('识别接口尚未加载，请完全退出并重新启动 XingParty')
      }

      const captureGameKey = activeGame.key
      const session = await window.api.startRecognition(captureGameKey)
      setState(session.state)
      setLogs(await window.api.getAppLogs())

      if (session.mode === 'mock') {
        return
      }

      const { target } = session
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: target.sourceId
          }
        } as MediaTrackConstraints
      })
      const video = document.createElement('video')
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      const [videoTrack] = stream.getVideoTracks()

      captureStreamRef.current = stream
      videoTrack?.addEventListener('ended', async () => {
        stopLocalCapture()
        setState((await window.api.checkRecognitionTarget()).state)
        setLogs(await window.api.getAppLogs())
      })
      video.srcObject = stream
      video.muted = true
      await video.play()

      captureTimerRef.current = window.setInterval(
        async () => {
          if (captureInFlightRef.current) {
            return
          }

          captureInFlightRef.current = true

          try {
            const targetHealth = await window.api.checkRecognitionTarget()

            if (!targetHealth.alive) {
              stopLocalCapture()
              setState(targetHealth.state)
              setLogs(await window.api.getAppLogs())
              return
            }

            if (!context || video.videoWidth === 0 || video.videoHeight === 0) {
              return
            }

            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            context.drawImage(video, 0, 0, canvas.width, canvas.height)

            const latestState = await window.api.submitRecognitionFrame({
              gameKey: captureGameKey,
              capturedAt: new Date().toISOString(),
              imageDataUrl: canvas.toDataURL('image/jpeg', 0.72),
              width: canvas.width,
              height: canvas.height
            })

            setState(latestState)
          } finally {
            captureInFlightRef.current = false
          }
        },
        Math.min(1500, Math.max(1000, target.profile.captureIntervalMs))
      )
    } catch (error) {
      stopLocalCapture()
      setState(await window.api.stopRecognition())
      setLogs(await window.api.getAppLogs())
      setRecognitionError(
        error instanceof Error ? error.message : t('errors.recognitionStartFailed')
      )
    }
  }

  const stop = async (): Promise<void> => {
    stopLocalCapture()
    setRecognitionError(undefined)
    setState(await window.api.stopRecognition())
    setLogs(await window.api.getAppLogs())
  }

  const uploadVideo = async (file: File): Promise<void> => {
    if (!activeGame) {
      return
    }

    stopLocalCapture()
    setRecognitionError(undefined)

    try {
      const captureGameKey = activeGame.key
      const filePath = window.api.getVideoFilePath(file)
      if (!filePath) {
        throw new Error('无法读取视频文件路径，请重新选择视频')
      }
      setState(await window.api.startVideoFileRecognition(captureGameKey, filePath))
      setLogs(await window.api.getAppLogs())
    } catch (error) {
      stopLocalCapture()
      setState(await window.api.stopRecognition())
      setLogs(await window.api.getAppLogs())
      setRecognitionError(
        error instanceof Error ? error.message : t('errors.recognitionStartFailed')
      )
    }
  }

  const selectVideo = (): void => {
    videoInputRef.current?.click()
  }

  const showSettings = (): void => {
    setActiveView(SETTINGS_VIEW)
  }

  const selectRailTab = async (value: string): Promise<void> => {
    if (value === SETTINGS_VIEW) {
      showSettings()
      return
    }

    if (value === LOGS_VIEW) {
      setActiveView(LOGS_VIEW)
      setLogs(await window.api.getAppLogs())
      return
    }
  }

  if (!state) {
    return (
      <div className="loadingView">
        <Spinner label={t('status.ready')} />
      </div>
    )
  }

  return (
    <div className="appShell">
      <input
        ref={videoInputRef}
        type="file"
        accept=".mp4,video/mp4,video/*"
        hidden
        onChange={(event) => {
          const [file] = Array.from(event.target.files ?? [])
          event.target.value = ''
          if (file) {
            void uploadVideo(file)
          }
        }}
      />
      <aside className="gameRail" aria-label={t('nav.gameCatalog')}>
        {activeGame ? (
          <Tooltip content={gameName} relationship="label">
            <Button
              appearance="transparent"
              className="railGameIcon"
              aria-label={gameName}
              aria-current={activeView === activeGame.key ? 'page' : undefined}
              onClick={() => setActiveView(activeGame.key)}
            >
              {GAME_LOGOS[activeGame.key] ? (
                <Image
                  className="gameTabLogo"
                  src={GAME_LOGOS[activeGame.key]}
                  alt=""
                  fit="contain"
                />
              ) : (
                <span className="gameTabFallback">?</span>
              )}
            </Button>
          </Tooltip>
        ) : null}
        <TabList
          className="railTabs"
          appearance="transparent"
          selectedValue={activeView}
          vertical
          onTabSelect={(_, data) => selectRailTab(String(data.value))}
        >
          <Tooltip content={t('logs.title')} relationship="label">
            <Tab
              className="railTab logsTab"
              value={LOGS_VIEW}
              icon={<DocumentBulletList24Regular />}
            >
              {null}
            </Tab>
          </Tooltip>
          <Tooltip content={t('settings.title')} relationship="label">
            <Tab className="railTab settingsTab" value={SETTINGS_VIEW} icon={<Settings24Regular />}>
              {null}
            </Tab>
          </Tooltip>
        </TabList>
      </aside>

      <main className="mainArea">
        {activeView === SETTINGS_VIEW ? (
          <SoftwareSettingsPage
            state={state}
            onRefreshGameRoles={async () => {
              const nextState = await window.api.refreshGameRoles()
              setState(nextState)
              setLogs(await window.api.getAppLogs())
              return nextState
            }}
            onSettingsChange={async (update) => {
              const nextState = await window.api.updateClientSettings(update)
              setState(nextState)
              return nextState
            }}
          />
        ) : activeView === LOGS_VIEW ? (
          <RuntimeLogsPage logs={logs} onClearLogs={clearLogs} onExportLogs={exportLogs} />
        ) : (
          <section className="contentGrid">
            <GameStatsPanel
              state={state}
              gameName={gameName}
              recognitionError={recognitionError}
              onRefresh={refresh}
              onStartRecognition={startRecognition}
              onUploadVideo={selectVideo}
              onStop={stop}
            />
          </section>
        )}
      </main>
    </div>
  )
}

function getDisplayName(game: StoredGame | undefined, t: (key: string) => string): string {
  if (!game) {
    return t('games.unsupported')
  }

  const meta = getGameMeta(game.key)
  return meta ? t(meta.nameKey) : t('games.unsupported')
}

export default GameShell
