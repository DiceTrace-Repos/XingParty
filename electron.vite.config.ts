import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    main: {
      define: {
        'process.env.MOCK_DATA': JSON.stringify(env.MOCK_DATA ?? ''),
        'process.env.XINGPARTY_API_BASE_URL': JSON.stringify(env.XINGPARTY_API_BASE_URL ?? '')
      }
    },
    preload: {},
    renderer: {
      resolve: {
        alias: {
          '@renderer': resolve('src/renderer/src')
        }
      },
      plugins: [react()]
    }
  }
})
