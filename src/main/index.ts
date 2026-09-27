import { app, shell, BrowserWindow, ipcMain, desktopCapturer, dialog } from 'electron'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { EncryptedStorage } from './encrypted-storage'
import { LocalStore } from './local-store'
import { RecognitionWorker } from './recognition-worker'
import { appLogger } from './app-logger'
import { createWindowMatcher } from './window-matcher'
import { getGameAdapter } from '../games/registry'
import type {
  BootstrapState,
  RecognitionCaptureTarget,
  RecognitionFramePayload,
  RecognitionTargetHealth
} from '../shared/types'

let localStore: LocalStore
let recognitionWorker: RecognitionWorker

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    title: 'XingParty',
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  localStore = new LocalStore(new EncryptedStorage())
  recognitionWorker = new RecognitionWorker(localStore)
  appLogger.info('app', '应用初始化完成', {
    platform: process.platform,
    resourcesPath: process.resourcesPath,
    appPath: app.getAppPath()
  })

  app.setName('XingParty')

  if (process.platform === 'darwin') {
    app.dock?.setIcon(icon)
  }

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.xingparty.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('app:get-bootstrap-state', () => {
    return localStore.getBootstrapState(recognitionWorker.getStatus().running)
  })

  ipcMain.handle('app:get-logs', () => {
    return appLogger.list()
  })

  ipcMain.handle('app:clear-logs', () => {
    appLogger.clear()
    appLogger.info('app', '日志已清空')
    return appLogger.list()
  })

  ipcMain.handle('app:export-logs', async () => {
    const logs = appLogger.list()
    const result = await dialog.showSaveDialog({
      title: '导出运行日志',
      defaultPath: `xingparty-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })

    if (result.canceled || !result.filePath) {
      appLogger.info('logs', '取消导出运行日志')
      return { canceled: true }
    }

    writeFileSync(result.filePath, JSON.stringify(logs, null, 2), 'utf-8')
    appLogger.info('logs', '运行日志已导出', { filePath: result.filePath, count: logs.length })

    return { canceled: false, filePath: result.filePath }
  })

  ipcMain.handle('games:refresh-catalog', () => {
    appLogger.info('catalog', '刷新游戏列表')
    localStore.refreshGames()
    return localStore.getBootstrapState(recognitionWorker.getStatus().running)
  })

  ipcMain.handle('games:set-active', (_, key: string) => {
    appLogger.info('game', '切换当前游戏', { key })
    return localStore.setActiveGame(key)
  })

  ipcMain.handle('recognition:start-mock', (_, key: string) => {
    appLogger.info('recognition', '启动模拟识别', { key })
    recognitionWorker.startMock(key)
    return localStore.getBootstrapState(recognitionWorker.getStatus().running)
  })

  ipcMain.handle('recognition:prepare-capture', async (_, key: string) => {
    try {
      appLogger.info('recognition', '准备启动窗口捕获', { key })
      const target = await prepareCaptureTarget(key)
      recognitionWorker.startCapture(target)
      appLogger.info('recognition', '窗口捕获会话已启动', {
        sourceId: target.sourceId,
        sourceName: target.sourceName,
        window: target.window
      })

      return {
        state: localStore.getBootstrapState(recognitionWorker.getStatus().running),
        target
      }
    } catch (error) {
      appLogger.error('recognition', '窗口捕获准备失败', error)
      throw error
    }
  })

  ipcMain.handle('recognition:submit-frame', (_, payload: RecognitionFramePayload) => {
    recognitionWorker.submitFrame(payload)
    return localStore.getBootstrapState(recognitionWorker.getStatus().running)
  })

  ipcMain.handle('recognition:check-target', async (): Promise<RecognitionTargetHealth> => {
    return checkRecognitionTarget()
  })

  ipcMain.handle('recognition:stop', () => {
    appLogger.info('recognition', '停止识别')
    recognitionWorker.stop()
    return localStore.getBootstrapState(false)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

async function prepareCaptureTarget(gameKey: string): Promise<RecognitionCaptureTarget> {
  const adapter = getGameAdapter(gameKey)
  const profile = adapter?.profile

  if (!profile) {
    appLogger.error('recognition', '未找到识别 profile', { gameKey })
    throw new Error(`未配置游戏识别参数：${gameKey}`)
  }

  const exePath = profile.exePaths[process.platform]

  if (!exePath) {
    appLogger.error('recognition', '当前平台未配置 exePath', {
      gameKey,
      platform: process.platform,
      configuredPlatforms: Object.keys(profile.exePaths)
    })
    throw new Error(`当前平台暂未配置游戏窗口路径：${process.platform}`)
  }

  appLogger.info('recognition', '使用 exePath 查找游戏窗口', {
    gameKey,
    platform: process.platform,
    exePath
  })
  const window = await createWindowMatcher().findSingleWindowByExePath(exePath)
  appLogger.info('recognition', '已找到唯一游戏窗口', window)

  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: 0, height: 0 }
  })
  appLogger.info('recognition', 'desktopCapturer 已枚举窗口源', {
    count: sources.length,
    sources: sources.map((source) => ({
      id: source.id,
      name: source.name
    }))
  })
  const hwndSource = sources.find((source) => source.id.includes(`:${window.hwnd}:`))
  const titleSource = sources.find((source) => source.name === window.title)
  const source = hwndSource ?? titleSource

  if (!source) {
    appLogger.error('recognition', 'desktopCapturer 无法匹配已找到的游戏窗口', {
      window,
      expectedHwndPattern: `:${window.hwnd}:`,
      availableSources: sources.map((item) => ({ id: item.id, name: item.name }))
    })
    throw new Error('已找到游戏窗口，但无法从 desktopCapturer 绑定窗口源')
  }

  appLogger.info('recognition', 'desktopCapturer 窗口源匹配成功', {
    matchedBy: hwndSource ? 'hwnd' : 'title',
    sourceId: source.id,
    sourceName: source.name
  })

  return {
    gameKey,
    sourceId: source.id,
    sourceName: source.name,
    window,
    profile
  }
}

async function checkRecognitionTarget(): Promise<RecognitionTargetHealth> {
  const runningState = recognitionWorker.getStatus()
  const target = recognitionWorker.getCaptureTarget()

  if (!runningState.running || !target) {
    return {
      alive: true,
      state: getBootstrapState()
    }
  }

  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: 0, height: 0 }
  })
  const sourceAlive = sources.some((source) => source.id === target.sourceId)

  if (sourceAlive) {
    return {
      alive: true,
      state: getBootstrapState()
    }
  }

  appLogger.warn('recognition', '目标窗口已关闭或窗口源已消失，自动停止识别', {
    gameKey: target.gameKey,
    sourceId: target.sourceId,
    sourceName: target.sourceName,
    window: target.window
  })
  recognitionWorker.stop()

  return {
    alive: false,
    state: getBootstrapState()
  }
}

function getBootstrapState(): BootstrapState {
  return localStore.getBootstrapState(recognitionWorker.getStatus().running)
}
