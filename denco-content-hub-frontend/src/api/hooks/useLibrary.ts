'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import {
  listLibraryItemsApiV1WorkspacesWorkspaceIdLibraryGet,
  getLibraryItemApiV1WorkspacesWorkspaceIdLibraryItemIdGet,
  createLibraryItemApiV1WorkspacesWorkspaceIdLibraryPost,
  updateLibraryItemApiV1WorkspacesWorkspaceIdLibraryItemIdPatch,
  deleteLibraryItemApiV1WorkspacesWorkspaceIdLibraryItemIdDelete,
  generateLibraryItemApiV1WorkspacesWorkspaceIdLibraryItemIdGeneratePost,
} from '@/api/client'

import type {
  LibraryItemCreate,
  LibraryItemUpdate,
  Platform,
  ContentType,
  Category,
  LibraryStatus,
} from '@/api/client/types.gen'

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const libraryKeys = {
  all: (workspaceId: number) => ['library', workspaceId] as const,
  list: (workspaceId: number, filters: LibraryFilters) =>
    ['library', workspaceId, filters] as const,
  item: (workspaceId: number, itemId: number) =>
    ['library', workspaceId, itemId] as const,
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LibraryFilters {
  page?: number
  size?: number
  platform?: Platform | null
  content_type?: ContentType | null
  category?: Category | null
  status?: LibraryStatus | null
  hunt_level?: number | null
  search?: string | null
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useLibraryItemsQuery(workspaceId: number, filters: LibraryFilters = {}) {
  const { page = 1, size = 20, platform, content_type, category, status, hunt_level, search } = filters

  return useQuery({
    queryKey: libraryKeys.list(workspaceId, { page, size, platform, content_type, category, status, hunt_level, search }),
    queryFn: async () => {
      const result = await listLibraryItemsApiV1WorkspacesWorkspaceIdLibraryGet({
        path: { workspace_id: workspaceId },
        query: {
          page,
          size,
          ...(platform ? { platform } : {}),
          ...(content_type ? { content_type } : {}),
          ...(category ? { category } : {}),
          ...(status ? { status } : {}),
          ...(hunt_level != null ? { hunt_level } : {}),
          ...(search ? { search } : {}),
        },
        throwOnError: true,
      })
      return result.data
    },
    enabled: !!workspaceId,
  })
}

export function useLibraryItemQuery(workspaceId: number, itemId: number) {
  return useQuery({
    queryKey: libraryKeys.item(workspaceId, itemId),
    queryFn: async () => {
      const result = await getLibraryItemApiV1WorkspacesWorkspaceIdLibraryItemIdGet({
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

export function useCreateLibraryItemMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (data: LibraryItemCreate) => {
      const result = await createLibraryItemApiV1WorkspacesWorkspaceIdLibraryPost({
        path: { workspace_id: workspaceId },
        body: data,
        throwOnError: true,
      })
      return result.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: libraryKeys.all(workspaceId) })
    },
  })
}

export function useUpdateLibraryItemMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ itemId, data }: { itemId: number; data: LibraryItemUpdate }) => {
      const result = await updateLibraryItemApiV1WorkspacesWorkspaceIdLibraryItemIdPatch({
        path: { workspace_id: workspaceId, item_id: itemId },
        body: data,
        throwOnError: true,
      })
      return result.data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: libraryKeys.all(workspaceId) })
      qc.invalidateQueries({ queryKey: libraryKeys.item(workspaceId, variables.itemId) })
    },
  })
}

export function useDeleteLibraryItemMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (itemId: number) => {
      await deleteLibraryItemApiV1WorkspacesWorkspaceIdLibraryItemIdDelete({
        path: { workspace_id: workspaceId, item_id: itemId },
        throwOnError: true,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: libraryKeys.all(workspaceId) })
    },
  })
}

export function useGenerateLibraryContentMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (itemId: number) => {
      const result = await generateLibraryItemApiV1WorkspacesWorkspaceIdLibraryItemIdGeneratePost({
        path: { workspace_id: workspaceId, item_id: itemId },
        throwOnError: true,
      })
      return result.data
    },
    onSuccess: (_data, itemId) => {
      qc.invalidateQueries({ queryKey: libraryKeys.all(workspaceId) })
      qc.invalidateQueries({ queryKey: libraryKeys.item(workspaceId, itemId) })
    },
  })
}
