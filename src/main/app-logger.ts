import { randomUUID } from 'crypto'
import type { AppLogEntry, AppLogLevel } from '../shared/types'

const MAX_LOGS = 300

class AppLogger {
  private entries: AppLogEntry[] = []

  info(scope: string, message: string, detail?: unknown): void {
    this.add('info', scope, message, detail)
  }

  warn(scope: string, message: string, detail?: unknown): void {
    this.add('warn', scope, message, detail)
  }

  error(scope: string, message: string, detail?: unknown): void {
    this.add('error', scope, message, detail)
  }

  list(): AppLogEntry[] {
    return [...this.entries].reverse()
  }

  clear(): void {
    this.entries = []
  }

  private add(level: AppLogLevel, scope: string, message: string, detail?: unknown): void {
    this.entries.push({
      id: randomUUID(),
      level,
      scope,
      message,
      detail: formatDetail(detail),
      createdAt: new Date().toISOString()
    })

    if (this.entries.length > MAX_LOGS) {
      this.entries = this.entries.slice(-MAX_LOGS)
    }
  }
}

function formatDetail(detail: unknown): string | undefined {
  if (detail === undefined) {
    return undefined
  }

  if (detail instanceof Error) {
    return detail.stack ?? detail.message
  }

  if (typeof detail === 'string') {
    return detail
  }

  try {
    return JSON.stringify(detail, null, 2)
  } catch {
    return String(detail)
  }
}

export const appLogger = new AppLogger()
