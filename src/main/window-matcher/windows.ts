import { execFile } from 'child_process'
import { promisify } from 'util'
import type { GameWindowCandidate } from '../../shared/types'
import { appLogger } from '../app-logger'
import { GameWindowLookupError, type GameWindowMatcher } from './types'

const execFileAsync = promisify(execFile)

const windowsScript = String.raw`
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;

public class Win32Window {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }
}
"@

$windows = New-Object System.Collections.Generic.List[object]

[Win32Window]::EnumWindows({
  param([IntPtr]$hwnd, [IntPtr]$lparam)

  if (-not [Win32Window]::IsWindowVisible($hwnd)) {
    return $true
  }

  $titleBuilder = New-Object System.Text.StringBuilder 512
  [void][Win32Window]::GetWindowText($hwnd, $titleBuilder, $titleBuilder.Capacity)
  $title = $titleBuilder.ToString()

  if ([string]::IsNullOrWhiteSpace($title)) {
    return $true
  }

  $windowProcessId = [uint32]0
  [void][Win32Window]::GetWindowThreadProcessId($hwnd, [ref]$windowProcessId)

  try {
    $process = Get-Process -Id $windowProcessId -ErrorAction Stop
    $exePath = $process.Path
  } catch {
    return $true
  }

  if ([string]::IsNullOrWhiteSpace($exePath)) {
    return $true
  }

  $rect = New-Object Win32Window+RECT
  [void][Win32Window]::GetWindowRect($hwnd, [ref]$rect)
  $width = $rect.Right - $rect.Left
  $height = $rect.Bottom - $rect.Top

  if ($width -le 0 -or $height -le 0) {
    return $true
  }

  $windows.Add([PSCustomObject]@{
    hwnd = $hwnd.ToInt64().ToString()
    pid = [int]$windowProcessId
    title = $title
    exePath = $exePath
    bounds = [PSCustomObject]@{
      x = $rect.Left
      y = $rect.Top
      width = $width
      height = $height
    }
  })

  return $true
}, [IntPtr]::Zero) | Out-Null

$windows | ConvertTo-Json -Depth 4
`

export class WindowsWindowMatcher implements GameWindowMatcher {
  async findSingleWindowByExePath(exePath: string): Promise<GameWindowCandidate> {
    const windows = await this.listVisibleWindows()
    const normalizedTarget = normalizeWindowsPath(exePath)
    appLogger.info('window-matcher', 'Win32 可见窗口枚举完成', {
      target: exePath,
      count: windows.length,
      windows: windows.map((window) => ({
        hwnd: window.hwnd,
        pid: window.pid,
        title: window.title,
        exePath: window.exePath,
        bounds: window.bounds
      }))
    })
    const matches = windows.filter(
      (window) => normalizeWindowsPath(window.exePath) === normalizedTarget
    )

    if (matches.length === 0) {
      appLogger.warn('window-matcher', '没有窗口匹配目标 exePath', {
        target: exePath,
        normalizedTarget,
        visibleExePaths: windows.map((window) => window.exePath)
      })
      throw new GameWindowLookupError('GAME_WINDOW_NOT_FOUND', '未找到目标游戏窗口')
    }

    if (matches.length > 1) {
      appLogger.warn('window-matcher', '目标 exePath 匹配到多个窗口', {
        target: exePath,
        matches
      })
      throw new GameWindowLookupError('MULTIPLE_GAME_WINDOWS', '检测到多个目标游戏窗口')
    }

    return matches[0]
  }

  private async listVisibleWindows(): Promise<GameWindowCandidate[]> {
    try {
      const { stdout } = await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        windowsScript
      ])

      if (!stdout.trim()) {
        return []
      }

      const parsed = JSON.parse(stdout) as GameWindowCandidate | GameWindowCandidate[]
      return Array.isArray(parsed) ? parsed : [parsed]
    } catch (error) {
      throw new GameWindowLookupError(
        'WINDOW_LOOKUP_FAILED',
        error instanceof Error ? error.message : '窗口枚举失败'
      )
    }
  }
}

function normalizeWindowsPath(value: string): string {
  return value.replace(/\//g, '\\').replace(/\\+$/g, '').toLocaleLowerCase()
}
