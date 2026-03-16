'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listContentApiV1WorkspacesWorkspaceIdContentGet,
  addContentApiV1WorkspacesWorkspaceIdContentPost,
  deleteContentApiV1WorkspacesWorkspaceIdContentContentIdDelete,
  getContentApiV1WorkspacesWorkspaceIdContentContentIdGet,
  retryContentApiV1WorkspacesWorkspaceIdContentContentIdRetryPost,
} from '@/api/client'
import type { AddContentRequest } from '@/api/client/types.gen'
import { getTranscriptionApi } from '@/api/transcription'
import { addSourceApi, type AddSourceParams } from '@/api/source'

interface UseContentListParams {
  workspaceId: number
  page?: number
  size?: number
  status?: string | null
  search?: string | null
}

const ACTIVE_STATUSES = ['pending', 'processing', 'downloading']

export function useContentListQuery({
  workspaceId,
  page = 1,
  size = 20,
  status = null,
  search = null,
}: UseContentListParams) {
  return useQuery({
    queryKey: ['content', workspaceId, { page, size, status, search }],
    queryFn: async () => {
      const result = await listContentApiV1WorkspacesWorkspaceIdContentGet({
        path: { workspace_id: workspaceId },
        query: {
          page,
          size,
          ...(status ? { status } : {}),
          ...(search ? { search } : {}),
        },
        throwOnError: true,
      })
      return result.data
    },
    enabled: !!workspaceId,
    refetchInterval: (query) => {
      const items = query.state.data?.items
      if (!items?.length) return false
      const hasActive = items.some((item) =>
        ACTIVE_STATUSES.includes(item.status.toLowerCase()),
      )
      return hasActive ? 3000 : false
    },
  })
}

export function useContentDetailQuery(workspaceId: number, contentId: number) {
  return useQuery({
    queryKey: ['content', workspaceId, contentId],
    queryFn: async () => {
      const result = await getContentApiV1WorkspacesWorkspaceIdContentContentIdGet({
        path: { workspace_id: workspaceId, content_id: contentId },
        throwOnError: true,
      })
      return result.data
    },
    enabled: !!workspaceId && !!contentId,
    refetchInterval: (query) => {
      const status = query.state.data?.status?.toLowerCase()
      if (status && ACTIVE_STATUSES.includes(status)) {
        return 3000
      }
      return false
    },
  })
}

export function useAddContentMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (data: AddContentRequest) => {
      const result = await addContentApiV1WorkspacesWorkspaceIdContentPost({
        path: { workspace_id: workspaceId },
        body: data,
        throwOnError: true,
      })
      return result.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['content', workspaceId] })
    },
  })
}

export function useAddSourceMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (params: AddSourceParams) => {
      return addSourceApi(workspaceId, params)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['content', workspaceId] })
    },
  })
}

export function useDeleteContentMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (contentId: number) => {
      await deleteContentApiV1WorkspacesWorkspaceIdContentContentIdDelete({
        path: { workspace_id: workspaceId, content_id: contentId },
        throwOnError: true,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['content', workspaceId] })
    },
  })
}

const TRANSCRIPTION_ACTIVE_STATUSES = ['pending', 'processing']

export function useTranscriptionQuery(workspaceId: number, contentId: number, contentStatus?: string) {
  return useQuery({
    queryKey: ['transcription', workspaceId, contentId],
    queryFn: () => getTranscriptionApi(workspaceId, contentId),
    enabled: !!workspaceId && !!contentId,
    refetchInterval: (query) => {
      const status = query.state.data?.status?.toLowerCase()
      // Poll while transcription is actively processing
      if (status && TRANSCRIPTION_ACTIVE_STATUSES.includes(status)) {
        return 3000
      }
      // Poll when transcription not yet created but content is still processing
      if (!status && contentStatus && ACTIVE_STATUSES.includes(contentStatus.toLowerCase())) {
        return 3000
      }
      return false
    },
  })
}

export function useRetryContentMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (contentId: number) => {
      const result = await retryContentApiV1WorkspacesWorkspaceIdContentContentIdRetryPost({
        path: { workspace_id: workspaceId, content_id: contentId },
        throwOnError: true,
      })
      return result.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['content', workspaceId] })
    },
  })
}
