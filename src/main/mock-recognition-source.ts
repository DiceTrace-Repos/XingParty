import { app } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { RawModelOutputFixture } from '../shared/raw-model-output'

const FIXTURE_PATH = join('mock', 'recognition', 'raw-model-output.example.json')

export function loadMockRecognitionFixture(): RawModelOutputFixture {
  const candidates = [
    join(app.getAppPath(), 'resources', FIXTURE_PATH),
    join(process.resourcesPath, FIXTURE_PATH)
  ]
  const fixturePath = candidates.find((candidate) => existsSync(candidate))

  if (!fixturePath) {
    throw new Error(`未找到模拟识别数据：${candidates.join(', ')}`)
  }

  const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8')) as Partial<RawModelOutputFixture>
  if (
    fixture.schemaVersion !== 2 ||
    !Array.isArray(fixture.frames) ||
    fixture.frames.length === 0
  ) {
    throw new Error(`模拟识别数据格式无效：${fixturePath}`)
  }

  return fixture as RawModelOutputFixture
}
