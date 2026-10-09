import { randomUUID } from 'crypto'
import type { ClientSettingsUpdate, ClientState } from '../shared/types'
import { EncryptedStorage } from './encrypted-storage'

const CLIENT_FILE = 'client_state'

export class ClientSettingsService {
  constructor(
    private readonly storage: EncryptedStorage,
    private readonly defaultGamePath = ''
  ) {}

  initialize(): ClientState {
    const existing = this.storage.readCollection<ClientState>(CLIENT_FILE, [])[0]
    if (existing) {
      const normalized: ClientState = {
        ...existing,
        gamePath:
          typeof existing.gamePath === 'string' && existing.gamePath.trim() !== ''
            ? existing.gamePath
            : this.defaultGamePath,
        autoShareData: typeof existing.autoShareData === 'boolean' ? existing.autoShareData : false
      }
      if (
        normalized.gamePath !== existing.gamePath ||
        normalized.autoShareData !== existing.autoShareData
      ) {
        normalized.updatedAt = new Date().toISOString()
        this.save(normalized)
      }
      return normalized
    }

    const now = new Date().toISOString()
    const client: ClientState = {
      clientId: randomUUID(),
      locale: 'zh-CN',
      gamePath: this.defaultGamePath,
      autoShareData: false,
      createdAt: now,
      updatedAt: now
    }
    this.storage.writeCollection(CLIENT_FILE, [client])
    return client
  }

  getClient(): ClientState {
    return this.storage.readCollection<ClientState>(CLIENT_FILE, [])[0] ?? this.initialize()
  }

  getDeviceId(): string {
    return this.getClient().clientId
  }

  isAutoShareDataEnabled(): boolean {
    return this.getClient().autoShareData
  }

  update(update: ClientSettingsUpdate): ClientState {
    const client = this.getClient()
    const next: ClientState = {
      ...client,
      gamePath:
        update.gamePath === undefined
          ? client.gamePath
          : update.gamePath.trim() || this.defaultGamePath,
      autoShareData:
        update.autoShareData === undefined ? client.autoShareData : update.autoShareData,
      updatedAt: new Date().toISOString()
    }
    this.save(next)
    return next
  }

  save(client: ClientState): void {
    this.storage.writeCollection(CLIENT_FILE, [client])
  }
}
