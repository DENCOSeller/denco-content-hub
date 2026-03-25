import { client } from '@/api/client/client.gen'
import { configureApiClient } from '@denco/ui/api'
import { createAuthBroadcast } from '@denco/ui/auth'
import { getAccessToken, clearTokens, redirectToSsoLogin, silentRefresh } from '@/lib/auth'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'

const broadcast = createAuthBroadcast({
  onTokenRefreshed: (_token) => {
    // Token cookie is already set server-side by auth-frontend via Set-Cookie header.
    // BroadcastChannel notifies this tab that a refresh happened in another tab,
    // so the next API request will pick up the fresh cookie automatically.
  },
  onLogout: () => {
    clearTokens()
    redirectToSsoLogin()
  },
})

configureApiClient({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: client as any,
  baseUrl: API_BASE_URL,
  getAccessToken,
  onUnauthorized: () => {
    clearTokens()
    redirectToSsoLogin()
  },
  refreshFn: () => silentRefresh(),
  broadcast,
})

// Send cookies (access_token) with every API request
client.interceptors.request.use((request) => {
  return new Request(request, { credentials: 'include' })
})
