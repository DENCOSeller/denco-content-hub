'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getMeApiV1UsersMeGet,
} from '@/api/client'
import { isAuthenticated, clearTokens, SSO_BASE_URL } from '@/lib/auth'
import { useAuthStore } from '@/stores/auth-store'

export function useLogoutMutation() {
  const queryClient = useQueryClient()
  const storeClearAuth = useAuthStore((s) => s.clearAuth)

  return useMutation({
    mutationFn: async () => {
      // SSO logout — just clear local state, redirect to SSO
      storeClearAuth()
      queryClient.clear()
    },
    onSettled: () => {
      storeClearAuth()
      queryClient.clear()
      const redirectUrl = typeof window !== 'undefined' ? window.location.origin : ''
      window.location.href = `${SSO_BASE_URL}/logout?redirect=${encodeURIComponent(redirectUrl)}`
    },
  })
}

export function useSsoLogout() {
  const queryClient = useQueryClient()
  const storeClearAuth = useAuthStore((s) => s.clearAuth)

  return () => {
    storeClearAuth()
    queryClient.clear()
    const ssoBaseUrl = SSO_BASE_URL
    window.location.href = `${ssoBaseUrl}/logout?redirect=${encodeURIComponent(window.location.origin)}`
  }
}

export function useMeQuery() {
  const storeSetUser = useAuthStore((s) => s.setUser)

  return useQuery({
    queryKey: ['users', 'me'],
    queryFn: async () => {
      const result = await getMeApiV1UsersMeGet({
        throwOnError: true,
      })
      storeSetUser(result.data)
      return result.data
    },
    enabled: isAuthenticated(),
  })
}
