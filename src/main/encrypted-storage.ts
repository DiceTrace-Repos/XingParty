import { app, safeStorage } from 'electron'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'

interface EncryptedPayload {
  version: 1
  iv: string
  authTag: string
  ciphertext: string
}

export class EncryptedStorage {
  private readonly dataDir: string
  private dataKey?: Buffer

  constructor() {
    this.dataDir = join(app.getPath('userData'), 'data')
    mkdirSync(this.dataDir, { recursive: true })
  }

  readCollection<T>(name: string, fallback: T[]): T[] {
    const filePath = this.getFilePath(name)

    if (!existsSync(filePath)) {
      return fallback
    }

    const payload = JSON.parse(readFileSync(filePath, 'utf-8')) as EncryptedPayload
    const key = this.getDataKey()
    const iv = Buffer.from(payload.iv, 'base64')
    const authTag = Buffer.from(payload.authTag, 'base64')
    const decipher = createDecipheriv('aes-256-gcm', key, iv)

    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, 'base64')),
      decipher.final()
    ])

    return JSON.parse(decrypted.toString('utf-8')) as T[]
  }

  writeCollection<T>(name: string, records: T[]): void {
    const filePath = this.getFilePath(name)
    mkdirSync(dirname(filePath), { recursive: true })

    const key = this.getDataKey()
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(records), 'utf-8'),
      cipher.final()
    ])

    const payload: EncryptedPayload = {
      version: 1,
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
      ciphertext: ciphertext.toString('base64')
    }

    writeFileSync(filePath, JSON.stringify(payload), 'utf-8')
  }

  private getFilePath(name: string): string {
    return join(this.dataDir, `${name}.enc`)
  }

  private getDataKey(): Buffer {
    if (this.dataKey) {
      return this.dataKey
    }

    const keyFile = join(this.dataDir, 'data_key')

    if (existsSync(keyFile)) {
      const protectedKey = Buffer.from(readFileSync(keyFile, 'utf-8'), 'base64')
      const rawKey = safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(protectedKey)
        : protectedKey.toString('utf-8')

      this.dataKey = Buffer.from(rawKey, 'base64')
      return this.dataKey
    }

    const key = randomBytes(32)
    const rawKey = key.toString('base64')
    const protectedKey = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(rawKey)
      : Buffer.from(rawKey, 'utf-8')

    writeFileSync(keyFile, protectedKey.toString('base64'), 'utf-8')
    this.dataKey = key
    return key
  }
}
