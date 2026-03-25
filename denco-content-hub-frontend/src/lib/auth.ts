import { createAuth, setRawCookie } from '@denco/ui/auth'

export const SSO_BASE_URL = process.env.NEXT_PUBLIC_SSO_BASE_URL || 'https://auth.denco.store'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://content-hub.denco.store'

const auth = createAuth({
  ssoBaseUrl: SSO_BASE_URL,
  appUrl: APP_URL,
  cookieDomain: '.denco.store',
})

export const getAccessToken = auth.getAccessToken
export const getRefreshToken = auth.getRefreshToken
export const clearTokens = auth.clearTokens
export const isAuthenticated = auth.isAuthenticated
export const getSsoLoginUrl = auth.getSsoLoginUrl
export const getSsoLogoutUrl = auth.getSsoLogoutUrl
export const redirectToSsoLogin = auth.redirectToSsoLogin
export const redirectToSsoLogout = auth.redirectToSsoLogout
export const silentRefresh = auth.silentRefresh

/**
 * Shim for backward compatibility with flows that return tokens in the response body
 * (e.g. local login, register, switch-org). In SSO mode, tokens are normally set
 * via Set-Cookie headers from auth-frontend. This writes the access_token cookie
 * client-side as a fallback.
 */
export function setTokens(access: string, _refresh: string): void {
  setRawCookie('access_token', access, 1, 900)
}
