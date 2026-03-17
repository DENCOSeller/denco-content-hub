'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { client } from '@/api/client/client.gen'

import type { KnowledgeNodeResponse } from '@/api/client/types.gen'

// ---------------------------------------------------------------------------
// Types (отсутствуют в types.gen.ts — определяем локально по бэкенд-схеме)
// ---------------------------------------------------------------------------

export interface KgConflictResponse {
  id: number
  company_node_id: number
  workspace_node_id: number
  conflict_type: string
  description: string | null
  status: string
  resolved_by_user_id: number | null
  resolved_at: string | null
  created_at: string
  company_node: KnowledgeNodeResponse | null
  workspace_node: KnowledgeNodeResponse | null
}

export interface ResolveConflictBody {
  status: 'resolved' | 'dismissed'
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const kgConflictKeys = {
  all: (workspaceId: number) => ['kg', 'conflicts', workspaceId] as const,
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useKgConflicts(workspaceId: number) {
  return useQuery({
    queryKey: kgConflictKeys.all(workspaceId),
    queryFn: async () => {
      const result = await client.get({
        url: '/api/v1/workspaces/{workspace_id}/knowledge/conflicts',
        path: { workspace_id: workspaceId },
        throwOnError: true,
      })
      return result.data as KgConflictResponse[]
    },
    enabled: !!workspaceId,
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useResolveConflict(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      conflictId,
      body,
    }: {
      conflictId: number
      body: ResolveConflictBody
    }) => {
      const result = await client.patch({
        url: '/api/v1/workspaces/{workspace_id}/knowledge/conflicts/{conflict_id}',
        path: { workspace_id: workspaceId, conflict_id: conflictId },
        body,
        throwOnError: true,
      })
      return result.data as { detail: string }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: kgConflictKeys.all(workspaceId) })
    },
  })
}
