'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getGraphApiV1WorkspacesWorkspaceIdKnowledgeGraphGet,
  listNodesApiV1WorkspacesWorkspaceIdKnowledgeNodesGet,
  createNodeApiV1WorkspacesWorkspaceIdKnowledgeNodesPost,
  getNodeApiV1WorkspacesWorkspaceIdKnowledgeNodesNodeIdGet,
  updateNodeApiV1WorkspacesWorkspaceIdKnowledgeNodesNodeIdPatch,
  deleteNodeApiV1WorkspacesWorkspaceIdKnowledgeNodesNodeIdDelete,
  getNodeVersionsApiV1WorkspacesWorkspaceIdKnowledgeNodesNodeIdVersionsGet,
  createEdgeApiV1WorkspacesWorkspaceIdKnowledgeEdgesPost,
  deleteEdgeApiV1WorkspacesWorkspaceIdKnowledgeEdgesEdgeIdDelete,
  batchUpdatePositionsApiV1WorkspacesWorkspaceIdKnowledgeNodesPositionsPatch,
} from '@/api/client'

import type {
  KnowledgeNodeCreate,
  KnowledgeNodeUpdate,
  KnowledgeEdgeCreate,
  BatchPositionUpdateRequest,
} from '@/api/client/types.gen'

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const organizationKnowledgeKeys = {
  graph: (organizationId: number) => ['organization-knowledge', 'graph', organizationId] as const,
  nodes: (organizationId: number) => ['organization-knowledge', 'nodes', organizationId] as const,
  node: (organizationId: number, nodeId: number) => ['organization-knowledge', 'node', organizationId, nodeId] as const,
  versions: (organizationId: number, nodeId: number) => ['organization-knowledge', 'versions', organizationId, nodeId] as const,
}

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

export function useOrganizationGraphQuery(organizationId: number) {
  return useQuery({
    queryKey: organizationKnowledgeKeys.graph(organizationId),
    queryFn: async () => {
      const result = await getGraphApiV1WorkspacesWorkspaceIdKnowledgeGraphGet({
        path: { workspace_id: organizationId },
        throwOnError: true,
      })
      return result.data
    },
    enabled: !!organizationId,
  })
}

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

interface UseOrganizationNodeListParams {
  organizationId: number
  nodeTypeDefId?: number | null
  search?: string | null
}

export function useOrganizationNodeListQuery({ organizationId, nodeTypeDefId, search }: UseOrganizationNodeListParams) {
  return useQuery({
    queryKey: [...organizationKnowledgeKeys.nodes(organizationId), { nodeTypeDefId, search }],
    queryFn: async () => {
      const result = await listNodesApiV1WorkspacesWorkspaceIdKnowledgeNodesGet({
        path: { workspace_id: organizationId },
        query: {
          ...(nodeTypeDefId ? { node_type_def_id: nodeTypeDefId } : {}),
          ...(search ? { search } : {}),
        } as Record<string, unknown>,
        throwOnError: true,
      })
      return result.data
    },
    enabled: !!organizationId,
  })
}

export function useOrganizationNodeQuery(organizationId: number, nodeId: number) {
  return useQuery({
    queryKey: organizationKnowledgeKeys.node(organizationId, nodeId),
    queryFn: async () => {
      const result = await getNodeApiV1WorkspacesWorkspaceIdKnowledgeNodesNodeIdGet({
        path: { workspace_id: organizationId, node_id: nodeId },
        throwOnError: true,
      })
      return result.data
    },
    enabled: !!organizationId && !!nodeId,
  })
}

export function useOrganizationCreateNodeMutation(organizationId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (data: KnowledgeNodeCreate) => {
      const result = await createNodeApiV1WorkspacesWorkspaceIdKnowledgeNodesPost({
        path: { workspace_id: organizationId },
        body: data,
        throwOnError: true,
      })
      return result.data
    },
    onSuccess: async () => {
      await qc.refetchQueries({ queryKey: organizationKnowledgeKeys.graph(organizationId) })
      qc.invalidateQueries({ queryKey: organizationKnowledgeKeys.nodes(organizationId) })
    },
  })
}

export function useOrganizationUpdateNodeMutation(organizationId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ nodeId, data }: { nodeId: number; data: KnowledgeNodeUpdate }) => {
      const result = await updateNodeApiV1WorkspacesWorkspaceIdKnowledgeNodesNodeIdPatch({
        path: { workspace_id: organizationId, node_id: nodeId },
        body: data,
        throwOnError: true,
      })
      return result.data
    },
    onSuccess: async (_data, variables) => {
      await qc.refetchQueries({ queryKey: organizationKnowledgeKeys.graph(organizationId) })
      qc.invalidateQueries({ queryKey: organizationKnowledgeKeys.node(organizationId, variables.nodeId) })
    },
  })
}

export function useOrganizationDeleteNodeMutation(organizationId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (nodeId: number) => {
      await deleteNodeApiV1WorkspacesWorkspaceIdKnowledgeNodesNodeIdDelete({
        path: { workspace_id: organizationId, node_id: nodeId },
        throwOnError: true,
      })
    },
    onSuccess: async () => {
      await qc.refetchQueries({ queryKey: organizationKnowledgeKeys.graph(organizationId) })
      qc.invalidateQueries({ queryKey: organizationKnowledgeKeys.nodes(organizationId) })
    },
  })
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

export function useOrganizationNodeVersionsQuery(organizationId: number, nodeId: number) {
  return useQuery({
    queryKey: organizationKnowledgeKeys.versions(organizationId, nodeId),
    queryFn: async () => {
      const result = await getNodeVersionsApiV1WorkspacesWorkspaceIdKnowledgeNodesNodeIdVersionsGet({
        path: { workspace_id: organizationId, node_id: nodeId },
        throwOnError: true,
      })
      return result.data
    },
    enabled: !!organizationId && !!nodeId,
  })
}

// ---------------------------------------------------------------------------
// Edges
// ---------------------------------------------------------------------------

export function useOrganizationCreateEdgeMutation(organizationId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (data: KnowledgeEdgeCreate) => {
      const result = await createEdgeApiV1WorkspacesWorkspaceIdKnowledgeEdgesPost({
        path: { workspace_id: organizationId },
        body: data,
        throwOnError: true,
      })
      return result.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: organizationKnowledgeKeys.graph(organizationId) })
    },
  })
}

export function useOrganizationDeleteEdgeMutation(organizationId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (edgeId: number) => {
      await deleteEdgeApiV1WorkspacesWorkspaceIdKnowledgeEdgesEdgeIdDelete({
        path: { workspace_id: organizationId, edge_id: edgeId },
        throwOnError: true,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: organizationKnowledgeKeys.graph(organizationId) })
    },
  })
}

// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------

export function useOrganizationBatchPositionsMutation(organizationId: number) {
  return useMutation({
    mutationFn: async (data: BatchPositionUpdateRequest) => {
      const result = await batchUpdatePositionsApiV1WorkspacesWorkspaceIdKnowledgeNodesPositionsPatch({
        path: { workspace_id: organizationId },
        body: data,
        throwOnError: true,
      })
      return result.data
    },
  })
}
