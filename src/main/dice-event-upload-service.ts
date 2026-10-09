import { createHash, createHmac, randomUUID } from 'crypto'
import { getApiUrl } from './api-config'
import type { DiceEvent } from '../shared/types'
import type { ClientSettingsService } from './client-settings-service'
import type { PlatformAdapter } from './platform-adapters/types'
import { appLogger } from './app-logger'

const SECRET_KEY = 'device-hmac-secret'

export class DiceEventUploadService {
  constructor(
    private readonly settings: ClientSettingsService,
    private readonly platform: PlatformAdapter
  ) {}

  async upload(events: DiceEvent[]): Promise<void> {
    if (events.length === 0 || !this.settings.isAutoShareDataEnabled()) return

    try {
      const deviceId = this.settings.getDeviceId()
      const secret = await this.getOrRegisterSecret(deviceId)
      const body = JSON.stringify({ events })
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const nonce = randomUUID()
      const bodyHash = createHash('sha256').update(body).digest('hex')
      const url = getApiUrl('/dice-events')
      const canonical = ['POST', new URL(url).pathname, timestamp, nonce, bodyHash].join('\n')
      const signature = createHmac('sha256', secret).update(canonical).digest('base64')

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': deviceId,
          'X-Timestamp': timestamp,
          'X-Nonce': nonce,
          'X-Signature': signature
        },
        body
      })
      if (!response.ok) throw new Error(`骰子事件上传失败：${response.status}`)
      const result = (await response.json()) as {
        summary: { received: number; stored: number; duplicate: number; rejected: number }
        results: Array<{
          index: number
          status: 'stored' | 'duplicate' | 'rejected'
          code?: string
          message?: string
        }>
      }
      appLogger.info('dice-event-upload', '骰子事件上传完成', result)
    } catch (error) {
      appLogger.warn('dice-event-upload', '骰子事件上传失败，已丢弃本次上传任务', error)
    }
  }

  private async getOrRegisterSecret(deviceId: string): Promise<string> {
    const existing = this.platform.secretStorage.get(SECRET_KEY)
    if (existing) return existing

    const response = await fetch(getApiUrl('/devices/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId })
    })
    if (!response.ok) throw new Error(`设备注册失败：${response.status}`)
    const payload = (await response.json()) as { secret?: string }
    if (!payload.secret) throw new Error('设备注册响应缺少 Secret')
    this.platform.secretStorage.set(SECRET_KEY, payload.secret)
    return payload.secret
  }
}
