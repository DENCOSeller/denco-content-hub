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
  NodeType,
} from '@/api/client/types.gen'

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const knowledgeKeys = {
  graph: (workspaceId: number) => ['knowledge', 'graph', workspaceId] as const,
  nodes: (workspaceId: number) => ['knowledge', 'nodes', workspaceId] as const,
  node: (workspaceId: number, nodeId: number) => ['knowledge', 'node', workspaceId, nodeId] as const,
  versions: (workspaceId: number, nodeId: number) => ['knowledge', 'versions', workspaceId, nodeId] as const,
}

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

export function useWorkspaceGraphQuery(workspaceId: number) {
  return useQuery({
    queryKey: knowledgeKeys.graph(workspaceId),
    queryFn: async () => {
      const result = await getGraphApiV1WorkspacesWorkspaceIdKnowledgeGraphGet({
        path: { workspace_id: workspaceId },
        throwOnError: true,
      })
      return result.data
    },
    enabled: !!workspaceId,
  })
}

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

interface UseNodeListParams {
  workspaceId: number
  nodeType?: NodeType | null
  search?: string | null
}

export function useNodeListQuery({ workspaceId, nodeType, search }: UseNodeListParams) {
  return useQuery({
    queryKey: [...knowledgeKeys.nodes(workspaceId), { nodeType, search }],
    queryFn: async () => {
      const result = await listNodesApiV1WorkspacesWorkspaceIdKnowledgeNodesGet({
        path: { workspace_id: workspaceId },
        query: {
          ...(nodeType ? { node_type: nodeType } : {}),
          ...(search ? { search } : {}),
        },
        throwOnError: true,
      })
      return result.data
    },
    enabled: !!workspaceId,
  })
}

export function useNodeQuery(workspaceId: number, nodeId: number) {
  return useQuery({
    queryKey: knowledgeKeys.node(workspaceId, nodeId),
    queryFn: async () => {
      const result = await getNodeApiV1WorkspacesWorkspaceIdKnowledgeNodesNodeIdGet({
        path: { workspace_id: workspaceId, node_id: nodeId },
        throwOnError: true,
      })
      return result.data
    },
    enabled: !!workspaceId && !!nodeId,
  })
}

export function useCreateNodeMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (data: KnowledgeNodeCreate) => {
      const result = await createNodeApiV1WorkspacesWorkspaceIdKnowledgeNodesPost({
        path: { workspace_id: workspaceId },
        body: data,
        throwOnError: true,
      })
      return result.data
    },
    onSuccess: async () => {
      await qc.refetchQueries({ queryKey: knowledgeKeys.graph(workspaceId) })
      qc.invalidateQueries({ queryKey: knowledgeKeys.nodes(workspaceId) })
    },
  })
}

export function useUpdateNodeMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ nodeId, data }: { nodeId: number; data: KnowledgeNodeUpdate }) => {
      const result = await updateNodeApiV1WorkspacesWorkspaceIdKnowledgeNodesNodeIdPatch({
        path: { workspace_id: workspaceId, node_id: nodeId },
        body: data,
        throwOnError: true,
      })
      return result.data
    },
    onSuccess: async (_data, variables) => {
      await qc.refetchQueries({ queryKey: knowledgeKeys.graph(workspaceId) })
      qc.invalidateQueries({ queryKey: knowledgeKeys.node(workspaceId, variables.nodeId) })
    },
  })
}

export function useDeleteNodeMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (nodeId: number) => {
      await deleteNodeApiV1WorkspacesWorkspaceIdKnowledgeNodesNodeIdDelete({
        path: { workspace_id: workspaceId, node_id: nodeId },
        throwOnError: true,
      })
    },
    onSuccess: async () => {
      await qc.refetchQueries({ queryKey: knowledgeKeys.graph(workspaceId) })
      qc.invalidateQueries({ queryKey: knowledgeKeys.nodes(workspaceId) })
    },
  })
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

export function useNodeVersionsQuery(workspaceId: number, nodeId: number) {
  return useQuery({
    queryKey: knowledgeKeys.versions(workspaceId, nodeId),
    queryFn: async () => {
      const result = await getNodeVersionsApiV1WorkspacesWorkspaceIdKnowledgeNodesNodeIdVersionsGet({
        path: { workspace_id: workspaceId, node_id: nodeId },
        throwOnError: true,
      })
      return result.data
    },
    enabled: !!workspaceId && !!nodeId,
  })
}

// ---------------------------------------------------------------------------
// Edges
// ---------------------------------------------------------------------------

export function useCreateEdgeMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (data: KnowledgeEdgeCreate) => {
      const result = await createEdgeApiV1WorkspacesWorkspaceIdKnowledgeEdgesPost({
        path: { workspace_id: workspaceId },
        body: data,
        throwOnError: true,
      })
      return result.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: knowledgeKeys.graph(workspaceId) })
    },
  })
}

export function useDeleteEdgeMutation(workspaceId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (edgeId: number) => {
      await deleteEdgeApiV1WorkspacesWorkspaceIdKnowledgeEdgesEdgeIdDelete({
        path: { workspace_id: workspaceId, edge_id: edgeId },
        throwOnError: true,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: knowledgeKeys.graph(workspaceId) })
    },
  })
}

// ---------------------------------------------------------------------------
// Nodes by type (convenience wrapper)
// ---------------------------------------------------------------------------

export function useKnowledgeNodesByType(workspaceId: number, nodeType: NodeType) {
  return useNodeListQuery({ workspaceId, nodeType })
}

// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------

export function useBatchPositionsMutation(workspaceId: number) {
  return useMutation({
    mutationFn: async (data: BatchPositionUpdateRequest) => {
      const result = await batchUpdatePositionsApiV1WorkspacesWorkspaceIdKnowledgeNodesPositionsPatch({
        path: { workspace_id: workspaceId },
        body: data,
        throwOnError: true,
      })
      return result.data
    },
  })
}
