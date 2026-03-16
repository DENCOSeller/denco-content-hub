import { getCookie, setRawCookie, deleteCookie } from '@/lib/cookies'

export function getAccessToken(): string | null {
  return getCookie('access_token')
}

export function getRefreshToken(): string | null {
  return getCookie('refresh_token')
}

export function setTokens(access: string, refresh: string): void {
  setRawCookie('access_token', access)
  setRawCookie('refresh_token', refresh)
}

export function clearTokens(): void {
  deleteCookie('access_token')
  deleteCookie('refresh_token')
}

export function isAuthenticated(): boolean {
  return !!getAccessToken()
}
