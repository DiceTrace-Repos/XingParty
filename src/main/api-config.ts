const DEFAULT_API_BASE_URL = 'http://localhost:8000/api/v1'

export const API_BASE_URL = (
  process.env['XINGPARTY_API_BASE_URL']?.trim() || DEFAULT_API_BASE_URL
).replace(/\/+$/, '')

export function getApiUrl(path: string): string {
  return `${API_BASE_URL}/${path.replace(/^\/+/, '')}`
}
