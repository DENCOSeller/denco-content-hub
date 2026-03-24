/**
 * Staff Service (SSO) API helper.
 * Used for endpoints that live on auth.denco.store (teams, custom roles, etc.)
 */
import { getAccessToken } from '@/lib/auth'

const SSO_BASE_URL = 'https://auth.denco.store'

export class StaffApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'StaffApiError'
    this.status = status
  }
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = await response.json()
    if (typeof body.detail === 'string') return body.detail
    if (Array.isArray(body.detail)) {
      return body.detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join('; ')
    }
    return JSON.stringify(body)
  } catch {
    return `HTTP ${response.status}`
  }
}

export async function staffFetch<T>(
  path: string,
  options: {
    method?: string
    body?: unknown
  } = {},
): Promise<T> {
  const token = getAccessToken()
  if (!token) throw new StaffApiError('Нет токена авторизации', 401)

  const { method = 'GET', body } = options

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${SSO_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const detail = await parseError(response)
    throw new StaffApiError(detail, response.status)
  }

  // 204 No Content
  if (response.status === 204) return undefined as T

  return response.json() as Promise<T>
}
