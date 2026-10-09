import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { SecretStorageAdapter } from './types'

export function createSafeStorageFileAdapter(unavailableMessage: string): SecretStorageAdapter {
  const secretDirectory = join(app.getPath('userData'), 'secrets')

  function ensureAvailable(): void {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error(unavailableMessage)
    }
  }

  function getSecretPath(key: string): string {
    return join(secretDirectory, `${encodeURIComponent(key)}.secret`)
  }

  return {
    get: (key) => {
      ensureAvailable()
      const filePath = getSecretPath(key)
      if (!existsSync(filePath)) return undefined
      return safeStorage.decryptString(Buffer.from(readFileSync(filePath, 'utf-8'), 'base64'))
    },
    set: (key, value) => {
      ensureAvailable()
      const filePath = getSecretPath(key)
      mkdirSync(dirname(filePath), { recursive: true })
      writeFileSync(filePath, safeStorage.encryptString(value).toString('base64'), 'utf-8')
    }
  }
}
