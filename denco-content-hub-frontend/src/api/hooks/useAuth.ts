'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  loginApiV1AuthLoginPost,
  registerApiV1AuthRegisterPost,
  logoutApiV1AuthLogoutPost,
  getMeApiV1UsersMeGet,
} from '@/api/client'
import { setTokens, getRefreshToken, isAuthenticated } from '@/lib/auth'
import { useAuthStore } from '@/stores/auth-store'
import type { LoginRequest, RegisterRequest } from '@/api/client/types.gen'

export function useLoginMutation() {
  const storeSetUser = useAuthStore((s) => s.setUser)

  return useMutation({
    mutationFn: async (data: LoginRequest) => {
      const result = await loginApiV1AuthLoginPost({
        body: data,
        throwOnError: true,
      })

      setTokens(result.data.access_token, result.data.refresh_token)

      const meResult = await getMeApiV1UsersMeGet({
        throwOnError: true,
      })
      storeSetUser(meResult.data)

      return result
    },
  })
}

export function useRegisterMutation() {
  const storeSetUser = useAuthStore((s) => s.setUser)

  return useMutation({
    mutationFn: async (data: RegisterRequest) => {
      const result = await registerApiV1AuthRegisterPost({
        body: data,
        throwOnError: true,
      })

      setTokens(result.data.access_token, result.data.refresh_token)

      const meResult = await getMeApiV1UsersMeGet({
        throwOnError: true,
      })
      storeSetUser(meResult.data)

      return result
    },
  })
}

export function useLogoutMutation() {
  const queryClient = useQueryClient()
  const storeClearAuth = useAuthStore((s) => s.clearAuth)

  return useMutation({
    mutationFn: async () => {
      const refreshToken = getRefreshToken()
      if (!refreshToken) {
        storeClearAuth()
        return
      }
      await logoutApiV1AuthLogoutPost({
        body: { refresh_token: refreshToken },
        throwOnError: true,
      })
    },
    onSettled: () => {
      storeClearAuth()
      queryClient.clear()
    },
  })
}

export function useSsoLogout() {
  const queryClient = useQueryClient()
  const storeClearAuth = useAuthStore((s) => s.clearAuth)

  return () => {
    storeClearAuth()
    queryClient.clear()
    const ssoBaseUrl = process.env.NEXT_PUBLIC_SSO_BASE_URL || 'https://auth.denco.store'
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
