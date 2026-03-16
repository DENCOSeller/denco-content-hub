'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import {
  listPlanItemsApiV1WorkspacesWorkspaceIdContentPlanGet,
  getPlanItemApiV1WorkspacesWorkspaceIdContentPlanItemIdGet,
  createPlanItemApiV1WorkspacesWorkspaceIdContentPlanPost,
  updatePlanItemApiV1WorkspacesWorkspaceIdContentPlanItemIdPatch,
  deletePlanItemApiV1WorkspacesWorkspaceIdContentPlanItemIdDelete,
  publishPlanItemApiV1WorkspacesWorkspaceIdContentPlanItemIdPublishPatch,
  updatePlanItemMetricsApiV1WorkspacesWorkspaceIdContentPlanItemIdMetricsPatch,
} from '@/api/client'

import type {
  ContentPlanItemCreate,
  ContentPlanItemUpdate,
  ContentPlanMetricsUpdate,
  PlanItemStatus,
  Platform,
} from '@/api/client/types.gen'

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const contentPlanKeys = {
  all: (workspaceId: number) => ['content-plan', workspaceId] as const,
  list: (workspaceId: number, filters: ContentPlanFilters) =>
    ['content-plan', workspaceId, filters] as const,
  item: (workspaceId: number, itemId: number) =>
    ['content-plan', workspaceId, itemId] as const,
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContentPlanFilters {
  page?: number
  size?: number
  date_from?: string | null
  date_to?: string | null
  status?: PlanItemStatus | null
  platform?: Platform | null
  assignee_id?: number | null
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useContentPlanItemsQuery(
  workspaceId: number,
  filters: ContentPlanFilters = {},
) {
  const {
    page = 1,
    size = 20,
    date_from,
    date_to,
    status,
    platform,
    assignee_id,
  } = filters

  return useQuery({
    queryKey: contentPlanKeys.list(workspaceId, {
      page,
      size,
      date_from,
      date_to,
      status,
      platform,
      assignee_id,
    }),
    queryFn: async () => {
      const result =
        await listPlanItemsApiV1WorkspacesWorkspaceIdContentPlanGet({
          path: { workspace_id: workspaceId },
          query: {
            page,
            size,
            ...(date_from ? { date_from } : {}),
            ...(date_to ? { date_to } : {}),
            ...(status ? { status } : {}),
            ...(platform ? { platform } : {}),
            ...(assignee_id != null ? { assignee_id } : {}),
          },
          throwOnError: true,
        })
      return result.data
    },
    enabled: !!workspaceId,
  })
}

export function useContentPlanItemQuery(
  workspaceId: number,
  itemId: number,
) {
  return useQuery({
    queryKey: contentPlanKeys.item(workspaceId, itemId),
    queryFn: async () => {
      const result =
        await getPlanItemApiV1WorkspacesWorkspaceIdContentPlanItemIdGet({
          path: { workspace_id: workspaceId, item_id: itemId },
          throwOnError: true,
        })
      return result.data
    },
    enabled: !!workspaceId && !!itemId,
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateContentPlanItemMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (data: ContentPlanItemCreate) => {
      const result =
        await createPlanItemApiV1WorkspacesWorkspaceIdContentPlanPost({
          path: { workspace_id: workspaceId },
          body: data,
          throwOnError: true,
        })
      return result.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contentPlanKeys.all(workspaceId) })
    },
  })
}

export function useUpdateContentPlanItemMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      itemId,
      data,
    }: {
      itemId: number
      data: ContentPlanItemUpdate
    }) => {
      const result =
        await updatePlanItemApiV1WorkspacesWorkspaceIdContentPlanItemIdPatch({
          path: { workspace_id: workspaceId, item_id: itemId },
          body: data,
          throwOnError: true,
        })
      return result.data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: contentPlanKeys.all(workspaceId) })
      qc.invalidateQueries({
        queryKey: contentPlanKeys.item(workspaceId, variables.itemId),
      })
    },
  })
}

export function useDeleteContentPlanItemMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (itemId: number) => {
      await deletePlanItemApiV1WorkspacesWorkspaceIdContentPlanItemIdDelete({
        path: { workspace_id: workspaceId, item_id: itemId },
        throwOnError: true,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contentPlanKeys.all(workspaceId) })
    },
  })
}

export function usePublishContentPlanItemMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (itemId: number) => {
      const result =
        await publishPlanItemApiV1WorkspacesWorkspaceIdContentPlanItemIdPublishPatch(
          {
            path: { workspace_id: workspaceId, item_id: itemId },
            throwOnError: true,
          },
        )
      return result.data
    },
    onSuccess: (_data, itemId) => {
      qc.invalidateQueries({ queryKey: contentPlanKeys.all(workspaceId) })
      qc.invalidateQueries({
        queryKey: contentPlanKeys.item(workspaceId, itemId),
      })
    },
  })
}

export function useUpdateContentPlanMetricsMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      itemId,
      data,
    }: {
      itemId: number
      data: ContentPlanMetricsUpdate
    }) => {
      const result =
        await updatePlanItemMetricsApiV1WorkspacesWorkspaceIdContentPlanItemIdMetricsPatch(
          {
            path: { workspace_id: workspaceId, item_id: itemId },
            body: data,
            throwOnError: true,
          },
        )
      return result.data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: contentPlanKeys.all(workspaceId) })
      qc.invalidateQueries({
        queryKey: contentPlanKeys.item(workspaceId, variables.itemId),
      })
    },
  })
}
