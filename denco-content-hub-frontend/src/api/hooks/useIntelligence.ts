'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { client } from '@/api/client/client.gen'
import type { IntelligenceResponse } from '@/api/types/intelligence'

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const intelligenceKeys = {
  content: (workspaceId: number, contentId: number) =>
    ['intelligence', 'content', workspaceId, contentId] as const,
  competitorPost: (workspaceId: number, postId: number) =>
    ['intelligence', 'competitor-post', workspaceId, postId] as const,
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useContentIntelligenceQuery(
  workspaceId: number,
  contentId: number,
) {
  return useQuery({
    queryKey: intelligenceKeys.content(workspaceId, contentId),
    queryFn: async () => {
      const result = await client.get({
        url: '/api/v1/workspaces/{workspace_id}/content/{content_id}/intelligence',
        path: {
          workspace_id: workspaceId,
          content_id: contentId,
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
    enabled: !!workspaceId && !!contentId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'pending' || status === 'processing') return 3_000
      return false
    },
  })
}

export function useCompetitorPostIntelligenceQuery(
  workspaceId: number,
  postId: number,
) {
  return useQuery({
    queryKey: intelligenceKeys.competitorPost(workspaceId, postId),
    queryFn: async () => {
      const result = await client.get({
        url: '/api/v1/workspaces/{workspace_id}/competitors/posts/{post_id}/intelligence',
        path: {
          workspace_id: workspaceId,
          post_id: postId,
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
    enabled: !!workspaceId && !!postId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'pending' || status === 'processing') return 3_000
      return false
    },
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useGenerateContentIntelligenceMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      contentId,
      force = false,
    }: {
      contentId: number
      force?: boolean
    }) => {
      const { data } = await client.post<IntelligenceResponse, unknown, true>({
        url: '/api/v1/workspaces/{workspace_id}/content/{content_id}/intelligence/generate',
        path: {
          workspace_id: workspaceId,
          content_id: contentId,
        },
        query: { force },
        throwOnError: true,
      })
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: intelligenceKeys.content(workspaceId, variables.contentId),
      })
    },
  })
}

export function useGenerateCompetitorIntelligenceMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      postId,
      force = false,
    }: {
      postId: number
      force?: boolean
    }) => {
      const { data } = await client.post<IntelligenceResponse, unknown, true>({
        url: '/api/v1/workspaces/{workspace_id}/competitors/posts/{post_id}/intelligence/generate',
        path: {
          workspace_id: workspaceId,
          post_id: postId,
        },
        query: { force },
        throwOnError: true,
      })
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: intelligenceKeys.competitorPost(workspaceId, variables.postId),
      })
      qc.invalidateQueries({
        queryKey: ['competitors', 'posts'],
      })
    },
  })
}
