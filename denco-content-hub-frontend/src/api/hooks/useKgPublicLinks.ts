'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { client } from '@/api/client/client.gen'

// ---------------------------------------------------------------------------
// Types (отсутствуют в types.gen.ts — определяем локально по бэкенд-схеме)
// ---------------------------------------------------------------------------

export interface KgPublicLinkResponse {
  id: number
  token: string
  scope_type: string
  scope_id: number
  is_active: boolean
  visibility_mode: string
  title: string | null
  description: string | null
  expires_at: string | null
  created_at: string
  created_by_user_id: number | null
  public_url: string
}

export interface CreatePublicLinkBody {
  visibility_mode: string
  title?: string | null
  description?: string | null
  expires_at?: string | null
}

export interface UpdatePublicLinkBody {
  is_active?: boolean
  visibility_mode?: string
  title?: string | null
  description?: string | null
  expires_at?: string | null
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const kgPublicLinkKeys = {
  all: (scope: 'workspace' | 'company', scopeId: number) =>
    ['kg', 'public-links', scope, scopeId] as const,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseUrl(scope: 'workspace' | 'company', scopeId: number) {
  return scope === 'workspace'
    ? `/api/v1/workspaces/${scopeId}/knowledge/public-links`
    : `/api/v1/companies/${scopeId}/knowledge/public-links`
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useKgPublicLinks(scope: 'workspace' | 'company', scopeId: number) {
  return useQuery({
    queryKey: kgPublicLinkKeys.all(scope, scopeId),
    queryFn: async () => {
      const result = await client.get({
        url: baseUrl(scope, scopeId),
        throwOnError: true,
      })
      return result.data as KgPublicLinkResponse[]
    },
    enabled: !!scopeId,
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreatePublicLink(scope: 'workspace' | 'company', scopeId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (body: CreatePublicLinkBody) => {
      const result = await client.post({
        url: baseUrl(scope, scopeId),
        body,
        throwOnError: true,
      })
      return result.data as KgPublicLinkResponse
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: kgPublicLinkKeys.all(scope, scopeId) })
    },
  })
}

export function useUpdatePublicLink(scope: 'workspace' | 'company', scopeId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ linkId, body }: { linkId: number; body: UpdatePublicLinkBody }) => {
      const result = await client.patch({
        url: `${baseUrl(scope, scopeId)}/${linkId}`,
        body,
        throwOnError: true,
      })
      return result.data as KgPublicLinkResponse
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: kgPublicLinkKeys.all(scope, scopeId) })
    },
  })
}

export function useDeletePublicLink(scope: 'workspace' | 'company', scopeId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (linkId: number) => {
      await client.delete({
        url: `${baseUrl(scope, scopeId)}/${linkId}`,
        throwOnError: true,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: kgPublicLinkKeys.all(scope, scopeId) })
    },
  })
}
