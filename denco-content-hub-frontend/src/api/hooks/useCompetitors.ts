'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { client } from '@/api/client/client.gen'
import type {
  CompetitorChannel,
  CompetitorPostDetail,
  CompetitorAnalysis,
  CompetitorPostsFilters,
  CompetitorChannelUpdate,
  PaginatedResponse,
  CompetitorPost,
  CompetitorChannelSnapshot,
  ResolveUrlResponse,
  SyncResponse,
} from '@/api/types/competitor'

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const competitorKeys = {
  all: (workspaceId: number) => ['competitors', workspaceId] as const,
  list: (workspaceId: number, page: number, size: number) =>
    ['competitors', workspaceId, { page, size }] as const,
  detail: (channelId: number) => ['competitors', 'detail', channelId] as const,
  posts: (channelId: number, filters: CompetitorPostsFilters) =>
    ['competitors', 'posts', channelId, filters] as const,
  postDetail: (postId: number) => ['competitors', 'post', postId] as const,
  postAnalysis: (postId: number) =>
    ['competitors', 'post', postId, 'analysis'] as const,
  snapshots: (channelId: number, days: number) =>
    ['competitors', 'snapshots', channelId, { days }] as const,
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useCompetitorsQuery(
  workspaceId: number,
  page = 1,
  size = 20,
) {
  return useQuery({
    queryKey: competitorKeys.list(workspaceId, page, size),
    queryFn: async () => {
      const { data } = await client.get<PaginatedResponse<CompetitorChannel>, unknown, true>({
        url: '/api/v1/workspaces/{workspace_id}/competitors',
        path: { workspace_id: workspaceId },
        query: { page, size },
        throwOnError: true,
      })
      return data
    },
    enabled: !!workspaceId,
  })
}

export function useCompetitorDetailQuery(channelId: number) {
  return useQuery({
    queryKey: competitorKeys.detail(channelId),
    queryFn: async () => {
      const { data } = await client.get<CompetitorChannel, unknown, true>({
        url: '/api/v1/competitors/{channel_id}',
        path: { channel_id: channelId },
        throwOnError: true,
      })
      return data
    },
    enabled: !!channelId,
  })
}

export function useCompetitorPostsQuery(
  channelId: number,
  filters: CompetitorPostsFilters = {},
) {
  const { page = 1, size = 20, content_type, analysis_status, min_views } = filters

  return useQuery({
    queryKey: competitorKeys.posts(channelId, { page, size, content_type, analysis_status, min_views }),
    queryFn: async () => {
      const { data } = await client.get<PaginatedResponse<CompetitorPost>, unknown, true>({
        url: '/api/v1/competitors/{channel_id}/posts',
        path: { channel_id: channelId },
        query: {
          page,
          size,
          ...(content_type ? { content_type } : {}),
          ...(analysis_status ? { analysis_status } : {}),
          ...(min_views != null ? { min_views } : {}),
        },
        throwOnError: true,
      })
      return data
    },
    enabled: !!channelId,
  })
}

export function usePostDetailQuery(postId: number) {
  return useQuery({
    queryKey: competitorKeys.postDetail(postId),
    queryFn: async () => {
      const { data } = await client.get<CompetitorPostDetail, unknown, true>({
        url: '/api/v1/competitors/posts/{post_id}',
        path: { post_id: postId },
        throwOnError: true,
      })
      return data
    },
    enabled: !!postId,
  })
}

export function usePostAnalysisQuery(postId: number) {
  return useQuery({
    queryKey: competitorKeys.postAnalysis(postId),
    queryFn: async () => {
      const { data } = await client.get<CompetitorAnalysis, unknown, true>({
        url: '/api/v1/competitors/posts/{post_id}/analysis',
        path: { post_id: postId },
        throwOnError: true,
      })
      return data
    },
    enabled: !!postId,
  })
}

export function useChannelSnapshotsQuery(channelId: number, days = 30) {
  return useQuery({
    queryKey: competitorKeys.snapshots(channelId, days),
    queryFn: async () => {
      const { data } = await client.get<CompetitorChannelSnapshot[], unknown, true>({
        url: '/api/v1/competitors/{channel_id}/snapshots',
        path: { channel_id: channelId },
        query: { days },
        throwOnError: true,
      })
      return data
    },
    enabled: !!channelId,
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useAddCompetitorMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (url: string) => {
      const { data } = await client.post<CompetitorChannel, unknown, true>({
        url: '/api/v1/workspaces/{workspace_id}/competitors',
        path: { workspace_id: workspaceId },
        body: { url },
        throwOnError: true,
      })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: competitorKeys.all(workspaceId) })
    },
  })
}

export function useDeleteCompetitorMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (channelId: number) => {
      await client.delete<unknown, unknown, true>({
        url: '/api/v1/competitors/{channel_id}',
        path: { channel_id: channelId },
        throwOnError: true,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: competitorKeys.all(workspaceId) })
    },
  })
}

export function useUpdateCompetitorMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      channelId,
      data,
    }: {
      channelId: number
      data: CompetitorChannelUpdate
    }) => {
      const result = await client.patch<CompetitorChannel, unknown, true>({
        url: '/api/v1/competitors/{channel_id}',
        path: { channel_id: channelId },
        body: data,
        throwOnError: true,
      })
      return result.data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: competitorKeys.all(workspaceId) })
      qc.invalidateQueries({
        queryKey: competitorKeys.detail(variables.channelId),
      })
    },
  })
}

export function useSyncCompetitorMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (channelId: number) => {
      const { data } = await client.post<SyncResponse, unknown, true>({
        url: '/api/v1/competitors/{channel_id}/sync',
        path: { channel_id: channelId },
        throwOnError: true,
      })
      return data
    },
    onSuccess: (_data, channelId) => {
      qc.invalidateQueries({
        queryKey: competitorKeys.detail(channelId),
      })
      qc.invalidateQueries({
        queryKey: ['competitors', 'posts', channelId],
      })
    },
  })
}

export function useResolveUrlMutation() {
  return useMutation({
    mutationFn: async (url: string) => {
      const { data } = await client.post<ResolveUrlResponse, unknown, true>({
        url: '/api/v1/competitors/resolve-url',
        body: { url },
        throwOnError: true,
      })
      return data
    },
  })
}
