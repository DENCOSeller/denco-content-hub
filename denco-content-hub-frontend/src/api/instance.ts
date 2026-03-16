import { client } from '@/api/client/client.gen'
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from '@/lib/auth'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'

client.setConfig({
  baseUrl: API_BASE_URL,
})

client.interceptors.request.use((request) => {
  const token = getAccessToken()
  if (token) {
    request.headers.set('Authorization', `Bearer ${token}`)
  }
  return request
})

let isRefreshing = false

client.interceptors.response.use(async (response, request) => {
  if (response.status === 401 && !isRefreshing) {
    const refreshToken = getRefreshToken()

    if (refreshToken) {
      isRefreshing = true

      try {
        const refreshResponse = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        })

        if (refreshResponse.ok) {
          const data = await refreshResponse.json()
          setTokens(data.access_token, data.refresh_token)

          const retryRequest = new Request(request.url, request)
          retryRequest.headers.set('Authorization', `Bearer ${data.access_token}`)
          return fetch(retryRequest)
        }

        clearTokens()
        redirectToLogin()
      } catch {
        clearTokens()
        redirectToLogin()
      } finally {
        isRefreshing = false
      }
    } else {
      clearTokens()
      redirectToLogin()
    }
  }

  return response
})

function redirectToLogin(): void {
  if (typeof window !== 'undefined') {
    window.location.href = '/login'
  }
}
