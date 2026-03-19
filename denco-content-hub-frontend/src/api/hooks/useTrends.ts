'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { client } from '@/api/client/client.gen'
import type {
  TrendItem,
  TrendItemDetail,
  TrendNiche,
  TrendAlert,
  TrendAlertSettings,
  TrendAlertSettingsUpdate,
  TrendSnapshot,
  TrendNicheCreate,
  TrendNicheUpdate,
  TrendFilters,
  TrendAlertFilters,
  TaskAccepted,
  PaginatedResponse,
} from '@/api/types/trend'
import type { IntelligenceResponse } from '@/api/types/intelligence'

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const trendKeys = {
  all: (workspaceId: number) => ['trends', workspaceId] as const,
  list: (workspaceId: number, filters: TrendFilters) =>
    ['trends', workspaceId, 'list', filters] as const,
  detail: (workspaceId: number, trendId: number) =>
    ['trends', workspaceId, 'detail', trendId] as const,
  snapshots: (workspaceId: number, trendId: number) =>
    ['trends', workspaceId, 'snapshots', trendId] as const,
  niches: (workspaceId: number) =>
    ['trends', workspaceId, 'niches'] as const,
  nichesList: (workspaceId: number, page: number, size: number) =>
    ['trends', workspaceId, 'niches', { page, size }] as const,
  nicheDetail: (workspaceId: number, nicheId: number) =>
    ['trends', workspaceId, 'niche', nicheId] as const,
  alerts: (workspaceId: number, filters: TrendAlertFilters) =>
    ['trends', workspaceId, 'alerts', filters] as const,
  allAlerts: (workspaceId: number) =>
    ['trends', workspaceId, 'alerts'] as const,
  alertSettings: (workspaceId: number) =>
    ['trends', workspaceId, 'alert-settings'] as const,
  intelligence: (workspaceId: number, trendItemId: number) =>
    ['trends', workspaceId, 'intelligence', trendItemId] as const,
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useTrendsQuery(
  workspaceId: number,
  filters: TrendFilters = {},
) {
  const {
    page = 1,
    size = 20,
    platform,
    niche_id,
    stage,
    min_viral_score,
    sort_by,
  } = filters

  return useQuery({
    queryKey: trendKeys.list(workspaceId, {
      page, size, platform, niche_id, stage, min_viral_score, sort_by,
    }),
    queryFn: async () => {
      const { data } = await client.get<PaginatedResponse<TrendItem>, unknown, true>({
        url: '/api/v1/workspaces/{workspace_id}/trends',
        path: { workspace_id: workspaceId },
        query: {
          page,
          size,
          ...(platform ? { platform } : {}),
          ...(niche_id != null ? { niche_id } : {}),
          ...(stage ? { stage } : {}),
          ...(min_viral_score != null ? { min_viral_score } : {}),
          ...(sort_by ? { sort_by } : {}),
        },
        throwOnError: true,
      })
      return data
    },
    enabled: !!workspaceId,
  })
}

export function useTrendDetailQuery(
  workspaceId: number,
  trendId: number,
) {
  return useQuery({
    queryKey: trendKeys.detail(workspaceId, trendId),
    queryFn: async () => {
      const { data } = await client.get<TrendItemDetail, unknown, true>({
        url: '/api/v1/workspaces/{workspace_id}/trends/{trend_id}',
        path: { workspace_id: workspaceId, trend_id: trendId },
        throwOnError: true,
      })
      return data
    },
    enabled: !!workspaceId && !!trendId,
  })
}

export function useTrendSnapshotsQuery(
  workspaceId: number,
  trendId: number,
) {
  return useQuery({
    queryKey: trendKeys.snapshots(workspaceId, trendId),
    queryFn: async () => {
      const { data } = await client.get<TrendSnapshot[], unknown, true>({
        url: '/api/v1/workspaces/{workspace_id}/trends/{trend_id}/snapshots',
        path: { workspace_id: workspaceId, trend_id: trendId },
        throwOnError: true,
      })
      return data
    },
    enabled: !!workspaceId && !!trendId,
  })
}

export function useTrendNichesQuery(
  workspaceId: number,
  page = 1,
  size = 20,
  activeOnly = false,
) {
  return useQuery({
    queryKey: trendKeys.nichesList(workspaceId, page, size),
    queryFn: async () => {
      const { data } = await client.get<PaginatedResponse<TrendNiche>, unknown, true>({
        url: '/api/v1/workspaces/{workspace_id}/trends/niches',
        path: { workspace_id: workspaceId },
        query: { page, size, ...(activeOnly ? { active_only: true } : {}) },
        throwOnError: true,
      })
      return data
    },
    enabled: !!workspaceId,
  })
}

export function useTrendNicheDetailQuery(
  workspaceId: number,
  nicheId: number,
) {
  return useQuery({
    queryKey: trendKeys.nicheDetail(workspaceId, nicheId),
    queryFn: async () => {
      const { data } = await client.get<TrendNiche, unknown, true>({
        url: '/api/v1/workspaces/{workspace_id}/trends/niches/{niche_id}',
        path: { workspace_id: workspaceId, niche_id: nicheId },
        throwOnError: true,
      })
      return data
    },
    enabled: !!workspaceId && !!nicheId,
  })
}

export function useTrendAlertsQuery(
  workspaceId: number,
  filters: TrendAlertFilters = {},
) {
  const { unread_only, page = 1, size = 20 } = filters

  return useQuery({
    queryKey: trendKeys.alerts(workspaceId, { unread_only, page, size }),
    queryFn: async () => {
      const { data } = await client.get<PaginatedResponse<TrendAlert>, unknown, true>({
        url: '/api/v1/workspaces/{workspace_id}/trends/alerts',
        path: { workspace_id: workspaceId },
        query: {
          page,
          size,
          ...(unread_only != null ? { unread_only } : {}),
        },
        throwOnError: true,
      })
      return data
    },
    enabled: !!workspaceId,
  })
}

export function useTrendIntelligenceQuery(
  workspaceId: number,
  trendItemId: number,
) {
  return useQuery({
    queryKey: trendKeys.intelligence(workspaceId, trendItemId),
    queryFn: async () => {
      const result = await client.get({
        url: '/api/v1/workspaces/{workspace_id}/trends/{trend_item_id}/intelligence',
        path: {
          workspace_id: workspaceId,
          trend_item_id: trendItemId,
        },
      })
      if (result.response.status === 404) {
        return undefined
      }
      if (result.error) {
        throw new Error(
          (result.error as { detail?: string }).detail ?? 'Failed to load intelligence',
        )
      }
      return result.data as IntelligenceResponse
    },
    enabled: !!workspaceId && !!trendItemId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'pending' || status === 'processing') return 3_000
      return false
    },
  })
}

export function useAlertSettingsQuery(workspaceId: number) {
  return useQuery({
    queryKey: trendKeys.alertSettings(workspaceId),
    queryFn: async () => {
      const { data } = await client.get<TrendAlertSettings, unknown, true>({
        url: '/api/v1/workspaces/{workspace_id}/trends/alerts/settings',
        path: { workspace_id: workspaceId },
        throwOnError: true,
      })
      return data
    },
    enabled: !!workspaceId,
  })
}

export function useUpdateAlertSettingsMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (body: TrendAlertSettingsUpdate) => {
      const { data } = await client.put<TrendAlertSettings, unknown, true>({
        url: '/api/v1/workspaces/{workspace_id}/trends/alerts/settings',
        path: { workspace_id: workspaceId },
        body,
        throwOnError: true,
      })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: trendKeys.alertSettings(workspaceId) })
    },
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateTrendNicheMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (body: TrendNicheCreate) => {
      const { data } = await client.post<TrendNiche, unknown, true>({
        url: '/api/v1/workspaces/{workspace_id}/trends/niches',
        path: { workspace_id: workspaceId },
        body,
        throwOnError: true,
      })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: trendKeys.niches(workspaceId) })
    },
  })
}

export function useUpdateTrendNicheMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      nicheId,
      data,
    }: {
      nicheId: number
      data: TrendNicheUpdate
    }) => {
      const result = await client.patch<TrendNiche, unknown, true>({
        url: '/api/v1/workspaces/{workspace_id}/trends/niches/{niche_id}',
        path: { workspace_id: workspaceId, niche_id: nicheId },
        body: data,
        throwOnError: true,
      })
      return result.data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: trendKeys.niches(workspaceId) })
      qc.invalidateQueries({
        queryKey: trendKeys.nicheDetail(workspaceId, variables.nicheId),
      })
    },
  })
}

export function useDeleteTrendNicheMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (nicheId: number) => {
      await client.delete<unknown, unknown, true>({
        url: '/api/v1/workspaces/{workspace_id}/trends/niches/{niche_id}',
        path: { workspace_id: workspaceId, niche_id: nicheId },
        throwOnError: true,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: trendKeys.niches(workspaceId) })
    },
  })
}

export function useMarkAlertReadMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (alertId: number) => {
      const { data } = await client.patch<TrendAlert, unknown, true>({
        url: '/api/v1/workspaces/{workspace_id}/trends/alerts/{alert_id}/read',
        path: { workspace_id: workspaceId, alert_id: alertId },
        throwOnError: true,
      })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: trendKeys.allAlerts(workspaceId) })
    },
  })
}

export function useMarkAllAlertsReadMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      await client.post<unknown, unknown, true>({
        url: '/api/v1/workspaces/{workspace_id}/trends/alerts/read-all',
        path: { workspace_id: workspaceId },
        throwOnError: true,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: trendKeys.allAlerts(workspaceId) })
    },
  })
}

export function useDiscoverNowMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data } = await client.post<TaskAccepted, unknown, true>({
        url: '/api/v1/workspaces/{workspace_id}/trends/discover-now',
        path: { workspace_id: workspaceId },
        throwOnError: true,
      })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: trendKeys.all(workspaceId) })
    },
  })
}

export function useAnalyzeTrendMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (trendId: number) => {
      const { data } = await client.post<TaskAccepted, unknown, true>({
        url: '/api/v1/workspaces/{workspace_id}/trends/{trend_id}/analyze',
        path: { workspace_id: workspaceId, trend_id: trendId },
        throwOnError: true,
      })
      return data
    },
    onSuccess: (_data, trendId) => {
      qc.invalidateQueries({
        queryKey: trendKeys.detail(workspaceId, trendId),
      })
    },
  })
}

export function useGenerateTrendIntelligenceMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      trendItemId,
      force = false,
    }: {
      trendItemId: number
      force?: boolean
    }) => {
      const { data } = await client.post<IntelligenceResponse, unknown, true>({
        url: '/api/v1/workspaces/{workspace_id}/trends/{trend_item_id}/intelligence/generate',
        path: {
          workspace_id: workspaceId,
          trend_item_id: trendItemId,
        },
        query: { force },
        throwOnError: true,
      })
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: trendKeys.intelligence(workspaceId, variables.trendItemId),
      })
    },
  })
}
