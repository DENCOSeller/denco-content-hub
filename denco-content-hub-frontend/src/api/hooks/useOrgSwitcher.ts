'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useCallback } from 'react'
import { notifications } from '@mantine/notifications'
import { getAccessToken, setTokens } from '@/lib/auth'
import { getOrgsFromJwt } from '@/lib/jwt'
import { useOrganizationStore } from '@/stores/organization-store'

const SSO_BASE_URL = 'https://auth.denco.store'

interface SwitchOrgResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

/**
 * Reads available_orgs and active_org from the current JWT.
 */
export function useJwtOrgs() {
  const token = getAccessToken()
  return useMemo(() => getOrgsFromJwt(token), [token])
}

/**
 * Mutation: switch active organization via Staff Service.
 * Updates tokens and organization store, then reloads app context.
 */
export function useSwitchOrgMutation() {
  const queryClient = useQueryClient()
  const setActiveOrganization = useOrganizationStore((s) => s.setActiveOrganization)

  return useMutation({
    mutationFn: async (orgId: number): Promise<SwitchOrgResponse> => {
      const token = getAccessToken()
      if (!token) throw new Error('Нет токена авторизации')

      const response = await fetch(`${SSO_BASE_URL}/api/v1/auth/switch-org`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ org_id: orgId }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(
          (error as { detail?: string }).detail ?? `Ошибка переключения организации (${response.status})`,
        )
      }

      return response.json()
    },
    onError: (error) => {
      notifications.show({
        title: 'Ошибка',
        message: error.message || 'Не удалось переключить организацию',
        color: 'red',
        autoClose: 5000,
      })
    },
    onSuccess: (data) => {
      // Update tokens
      setTokens(data.access_token, data.refresh_token)

      // Update org store from new JWT
      const { activeOrg } = getOrgsFromJwt(data.access_token)
      if (activeOrg) {
        setActiveOrganization({
          id: activeOrg.id,
          name: activeOrg.name,
          slug: activeOrg.slug,
        })
      }

      // Invalidate all queries to reload data for new org context
      queryClient.invalidateQueries()
    },
  })
}

/**
 * Combined hook for org switcher UI.
 * Returns current org, available orgs, switch function, and loading state.
 */
export function useOrgSwitcher() {
  const { activeOrg, availableOrgs } = useJwtOrgs()
  const switchMutation = useSwitchOrgMutation()

  const switchOrg = useCallback(
    (orgId: number) => {
      if (orgId === activeOrg?.id) return
      switchMutation.mutate(orgId)
    },
    [activeOrg?.id, switchMutation.mutate],
  )

  return {
    activeOrg,
    availableOrgs,
    switchOrg,
    isSwitching: switchMutation.isPending,
    switchError: switchMutation.error,
    hasMultipleOrgs: availableOrgs.length > 1,
  }
}
