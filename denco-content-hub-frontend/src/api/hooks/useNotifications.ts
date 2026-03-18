'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { client } from '@/api/client/client.gen'
import type { CompetitorNotification, PaginatedResponse } from '@/api/types/competitor'

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const notificationKeys = {
  all: (workspaceId: number) =>
    ['competitor-notifications', workspaceId] as const,
  list: (workspaceId: number, unreadOnly: boolean) =>
    ['competitor-notifications', workspaceId, { unreadOnly }] as const,
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useCompetitorNotificationsQuery(
  workspaceId: number,
  unreadOnly = false,
) {
  return useQuery({
    queryKey: notificationKeys.list(workspaceId, unreadOnly),
    queryFn: async () => {
      const { data } = await client.get<PaginatedResponse<CompetitorNotification>, unknown, true>({
        url: '/api/v1/workspaces/{workspace_id}/competitor-notifications',
        path: { workspace_id: workspaceId },
        query: { unread_only: unreadOnly },
        throwOnError: true,
      })
      return data?.items ?? []
    },
    enabled: !!workspaceId,
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useMarkNotificationReadMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (notificationId: number) => {
      await client.post<unknown, unknown, true>({
        url: '/api/v1/competitor-notifications/{id}/read',
        path: { id: notificationId },
        throwOnError: true,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: notificationKeys.all(workspaceId),
      })
    },
  })
}

export function useMarkAllNotificationsReadMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      await client.post<unknown, unknown, true>({
        url: '/api/v1/workspaces/{workspace_id}/competitor-notifications/read-all',
        path: { workspace_id: workspaceId },
        throwOnError: true,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: notificationKeys.all(workspaceId),
      })
    },
  })
}
