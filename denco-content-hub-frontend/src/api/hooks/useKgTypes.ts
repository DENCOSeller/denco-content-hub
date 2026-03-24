'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { client } from '@/api/client/client.gen'

import type {
  KgNodeTypeDefCreate,
  KgNodeTypeDefResponse,
  KgEdgeTypeDefCreate,
  KgEdgeTypeDefResponse,
} from '@/api/client/types.gen'

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const kgTypeKeys = {
  nodeTypeDefs: (companyId: number) =>
    ['kg', 'node-type-defs', companyId] as const,
  edgeTypeDefs: (companyId: number) =>
    ['kg', 'edge-type-defs', companyId] as const,
}

// ---------------------------------------------------------------------------
// Node Type Defs — queries
// ---------------------------------------------------------------------------

export function useNodeTypeDefs(companyId: number) {
  return useQuery({
    queryKey: kgTypeKeys.nodeTypeDefs(companyId),
    queryFn: async () => {
      const result = await client.get({
        url: '/api/v1/organizations/{organization_id}/knowledge/types/nodes',
        path: { organization_id: companyId },
        throwOnError: true,
      })
      return result.data as KgNodeTypeDefResponse[]
    },
    enabled: !!companyId,
  })
}

// ---------------------------------------------------------------------------
// Node Type Defs — mutations
// ---------------------------------------------------------------------------

export function useCreateNodeTypeDef(companyId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (data: KgNodeTypeDefCreate) => {
      const result = await client.post({
        url: '/api/v1/organizations/{organization_id}/knowledge/types/nodes',
        path: { organization_id: companyId },
        body: data,
        throwOnError: true,
      })
      return result.data as KgNodeTypeDefResponse
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: kgTypeKeys.nodeTypeDefs(companyId) })
    },
  })
}

export function useDeactivateNodeTypeDef(companyId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (typeId: number) => {
      await client.patch({
        url: '/api/v1/organizations/{organization_id}/knowledge/types/nodes/{type_id}/deactivate',
        path: { organization_id: companyId, type_id: typeId },
        throwOnError: true,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: kgTypeKeys.nodeTypeDefs(companyId) })
    },
  })
}

// ---------------------------------------------------------------------------
// Edge Type Defs — queries
// ---------------------------------------------------------------------------

export function useEdgeTypeDefs(companyId: number) {
  return useQuery({
    queryKey: kgTypeKeys.edgeTypeDefs(companyId),
    queryFn: async () => {
      const result = await client.get({
        url: '/api/v1/organizations/{organization_id}/knowledge/types/edges',
        path: { organization_id: companyId },
        throwOnError: true,
      })
      return result.data as KgEdgeTypeDefResponse[]
    },
    enabled: !!companyId,
  })
}

// ---------------------------------------------------------------------------
// Edge Type Defs — mutations
// ---------------------------------------------------------------------------

export function useCreateEdgeTypeDef(companyId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (data: KgEdgeTypeDefCreate) => {
      const result = await client.post({
        url: '/api/v1/organizations/{organization_id}/knowledge/types/edges',
        path: { organization_id: companyId },
        body: data,
        throwOnError: true,
      })
      return result.data as KgEdgeTypeDefResponse
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: kgTypeKeys.edgeTypeDefs(companyId) })
    },
  })
}

export function useDeactivateEdgeTypeDef(companyId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (typeId: number) => {
      await client.patch({
        url: '/api/v1/organizations/{organization_id}/knowledge/types/edges/{type_id}/deactivate',
        path: { organization_id: companyId, type_id: typeId },
        throwOnError: true,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: kgTypeKeys.edgeTypeDefs(companyId) })
    },
  })
}
