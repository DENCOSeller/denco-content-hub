'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getGraphApiV1CompaniesCompanyIdKnowledgeGraphGet,
  listNodesApiV1CompaniesCompanyIdKnowledgeNodesGet,
  createNodeApiV1CompaniesCompanyIdKnowledgeNodesPost,
  getNodeApiV1CompaniesCompanyIdKnowledgeNodesNodeIdGet,
  updateNodeApiV1CompaniesCompanyIdKnowledgeNodesNodeIdPatch,
  deleteNodeApiV1CompaniesCompanyIdKnowledgeNodesNodeIdDelete,
  getNodeVersionsApiV1CompaniesCompanyIdKnowledgeNodesNodeIdVersionsGet,
  createEdgeApiV1CompaniesCompanyIdKnowledgeEdgesPost,
  deleteEdgeApiV1CompaniesCompanyIdKnowledgeEdgesEdgeIdDelete,
  batchUpdatePositionsApiV1CompaniesCompanyIdKnowledgeNodesPositionsPatch,
} from '@/api/client'

import type {
  KnowledgeNodeCreate,
  KnowledgeNodeUpdate,
  KnowledgeEdgeCreate,
  BatchPositionUpdateRequest,
  NodeType,
} from '@/api/client/types.gen'

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const companyKnowledgeKeys = {
  graph: (companyId: number) => ['company-knowledge', 'graph', companyId] as const,
  nodes: (companyId: number) => ['company-knowledge', 'nodes', companyId] as const,
  node: (companyId: number, nodeId: number) => ['company-knowledge', 'node', companyId, nodeId] as const,
  versions: (companyId: number, nodeId: number) => ['company-knowledge', 'versions', companyId, nodeId] as const,
}

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

export function useCompanyGraphQuery(companyId: number) {
  return useQuery({
    queryKey: companyKnowledgeKeys.graph(companyId),
    queryFn: async () => {
      const result = await getGraphApiV1CompaniesCompanyIdKnowledgeGraphGet({
        path: { company_id: companyId },
        throwOnError: true,
      })
      return result.data
    },
    enabled: !!companyId,
  })
}

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

interface UseCompanyNodeListParams {
  companyId: number
  nodeType?: NodeType | null
  search?: string | null
}

export function useCompanyNodeListQuery({ companyId, nodeType, search }: UseCompanyNodeListParams) {
  return useQuery({
    queryKey: [...companyKnowledgeKeys.nodes(companyId), { nodeType, search }],
    queryFn: async () => {
      const result = await listNodesApiV1CompaniesCompanyIdKnowledgeNodesGet({
        path: { company_id: companyId },
        query: {
          ...(nodeType ? { node_type: nodeType } : {}),
          ...(search ? { search } : {}),
        },
        throwOnError: true,
      })
      return result.data
    },
    enabled: !!companyId,
  })
}

export function useCompanyNodeQuery(companyId: number, nodeId: number) {
  return useQuery({
    queryKey: companyKnowledgeKeys.node(companyId, nodeId),
    queryFn: async () => {
      const result = await getNodeApiV1CompaniesCompanyIdKnowledgeNodesNodeIdGet({
        path: { company_id: companyId, node_id: nodeId },
        throwOnError: true,
      })
      return result.data
    },
    enabled: !!companyId && !!nodeId,
  })
}

export function useCompanyCreateNodeMutation(companyId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (data: KnowledgeNodeCreate) => {
      const result = await createNodeApiV1CompaniesCompanyIdKnowledgeNodesPost({
        path: { company_id: companyId },
        body: data,
        throwOnError: true,
      })
      return result.data
    },
    onSuccess: async () => {
      await qc.refetchQueries({ queryKey: companyKnowledgeKeys.graph(companyId) })
      qc.invalidateQueries({ queryKey: companyKnowledgeKeys.nodes(companyId) })
    },
  })
}

export function useCompanyUpdateNodeMutation(companyId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ nodeId, data }: { nodeId: number; data: KnowledgeNodeUpdate }) => {
      const result = await updateNodeApiV1CompaniesCompanyIdKnowledgeNodesNodeIdPatch({
        path: { company_id: companyId, node_id: nodeId },
        body: data,
        throwOnError: true,
      })
      return result.data
    },
    onSuccess: async (_data, variables) => {
      await qc.refetchQueries({ queryKey: companyKnowledgeKeys.graph(companyId) })
      qc.invalidateQueries({ queryKey: companyKnowledgeKeys.node(companyId, variables.nodeId) })
    },
  })
}

export function useCompanyDeleteNodeMutation(companyId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (nodeId: number) => {
      await deleteNodeApiV1CompaniesCompanyIdKnowledgeNodesNodeIdDelete({
        path: { company_id: companyId, node_id: nodeId },
        throwOnError: true,
      })
    },
    onSuccess: async () => {
      await qc.refetchQueries({ queryKey: companyKnowledgeKeys.graph(companyId) })
      qc.invalidateQueries({ queryKey: companyKnowledgeKeys.nodes(companyId) })
    },
  })
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

export function useCompanyNodeVersionsQuery(companyId: number, nodeId: number) {
  return useQuery({
    queryKey: companyKnowledgeKeys.versions(companyId, nodeId),
    queryFn: async () => {
      const result = await getNodeVersionsApiV1CompaniesCompanyIdKnowledgeNodesNodeIdVersionsGet({
        path: { company_id: companyId, node_id: nodeId },
        throwOnError: true,
      })
      return result.data
    },
    enabled: !!companyId && !!nodeId,
  })
}

// ---------------------------------------------------------------------------
// Edges
// ---------------------------------------------------------------------------

export function useCompanyCreateEdgeMutation(companyId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (data: KnowledgeEdgeCreate) => {
      const result = await createEdgeApiV1CompaniesCompanyIdKnowledgeEdgesPost({
        path: { company_id: companyId },
        body: data,
        throwOnError: true,
      })
      return result.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: companyKnowledgeKeys.graph(companyId) })
    },
  })
}

export function useCompanyDeleteEdgeMutation(companyId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (edgeId: number) => {
      await deleteEdgeApiV1CompaniesCompanyIdKnowledgeEdgesEdgeIdDelete({
        path: { company_id: companyId, edge_id: edgeId },
        throwOnError: true,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: companyKnowledgeKeys.graph(companyId) })
    },
  })
}

// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------

export function useCompanyBatchPositionsMutation(companyId: number) {
  return useMutation({
    mutationFn: async (data: BatchPositionUpdateRequest) => {
      const result = await batchUpdatePositionsApiV1CompaniesCompanyIdKnowledgeNodesPositionsPatch({
        path: { company_id: companyId },
        body: data,
        throwOnError: true,
      })
      return result.data
    },
  })
}
