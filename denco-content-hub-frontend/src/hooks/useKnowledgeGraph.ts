'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  useNodesState,
  useEdgesState,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type NodeChange,
  type EdgeChange,
  type Edge,
} from '@xyflow/react'

import { useWorkspaceGraphQuery, useBatchPositionsMutation } from '@/api/hooks/useKnowledge'
import { useCompanyGraphQuery, useCompanyBatchPositionsMutation } from '@/api/hooks/useCompanyKnowledge'
import { transformGraph, type KnowledgeNodeData, type KnowledgeEdgeData } from '@/lib/knowledge-transform'
import type { Node } from '@xyflow/react'
import type { NodeType } from '@/lib/knowledge-utils'

const POSITION_SAVE_DELAY = 500

export type KnowledgeScope = 'workspace' | 'company'

export function useKnowledgeGraph(scopeId: number, scope: KnowledgeScope = 'workspace') {
  const [filterType, setFilterType] = useState<NodeType | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const workspaceGraph = useWorkspaceGraphQuery(scope === 'workspace' ? scopeId : 0)
  const companyGraph = useCompanyGraphQuery(scope === 'company' ? scopeId : 0)
  const graphQuery = scope === 'workspace' ? workspaceGraph : companyGraph

  const workspaceBatch = useBatchPositionsMutation(scope === 'workspace' ? scopeId : 0)
  const companyBatch = useCompanyBatchPositionsMutation(scope === 'company' ? scopeId : 0)
  const batchPositions = scope === 'workspace' ? workspaceBatch : companyBatch

  const { data: graph, isLoading, isError, dataUpdatedAt } = graphQuery
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nodesRef = useRef<Node<KnowledgeNodeData>[]>([])

  const initial = useMemo(() => {
    if (!graph) return { nodes: [], edges: [] }
    return transformGraph(graph)
  }, [graph])

  const [nodes, setNodes, onNodesChangeBase] = useNodesState(initial.nodes)
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState(initial.edges)

  // Sync when data loads/changes — MERGE to preserve local positions
  useEffect(() => {
    if (!graph) return
    const transformed = transformGraph(graph)

    setNodes((current) => {
      // First load — no local state, use server data as-is
      if (current.length === 0) return transformed.nodes

      const currentMap = new Map(current.map((n) => [n.id, n]))

      // Compute center of existing nodes for placing new ones
      let cx = 0
      let cy = 0
      for (const n of current) {
        cx += n.position.x
        cy += n.position.y
      }
      cx /= current.length
      cy /= current.length

      // Count new nodes for even angular distribution
      const totalNew = transformed.nodes.filter((n) => !currentMap.has(n.id)).length
      let newIndex = 0

      return transformed.nodes.map((serverNode) => {
        const localNode = currentMap.get(serverNode.id)
        if (localNode) {
          // Existing node — keep local position, update data from server
          return { ...serverNode, position: localNode.position }
        }
        // New node — place near center with even radial offset
        const angle = (newIndex * 2 * Math.PI) / Math.max(totalNew, 1)
        const radius = 150 + newIndex * 50
        newIndex++
        return {
          ...serverNode,
          position: {
            x: cx + Math.cos(angle) * radius,
            y: cy + Math.sin(angle) * radius,
          },
        }
      })
    })

    setEdges(transformed.edges)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUpdatedAt])

  const savePositions = useCallback(
    (currentNodes: Node<KnowledgeNodeData>[]) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        const positions = currentNodes.map((n) => ({
          node_id: n.data.nodeId,
          position_x: n.position.x,
          position_y: n.position.y,
        }))
        batchPositions.mutate({ positions })
      }, POSITION_SAVE_DELAY)
    },
    [batchPositions],
  )

  const onNodesChange: OnNodesChange<Node<KnowledgeNodeData>> = useCallback(
    (changes: NodeChange<Node<KnowledgeNodeData>>[]) => {
      onNodesChangeBase(changes)

      const hasDrag = changes.some(
        (c) => c.type === 'position' && c.dragging === false,
      )
      if (hasDrag) {
        // After state update, schedule position save
        setTimeout(() => savePositions(nodesRef.current), 0)
      }
    },
    [onNodesChangeBase, savePositions],
  )

  const onEdgesChange: OnEdgesChange<Edge<KnowledgeEdgeData>> = useCallback(
    (changes: EdgeChange<Edge<KnowledgeEdgeData>>[]) => {
      onEdgesChangeBase(changes)
    },
    [onEdgesChangeBase],
  )

  // Keep ref in sync
  nodesRef.current = nodes

  const filteredNodes = useMemo(() => {
    let result = nodes
    if (filterType) {
      result = result.filter((n) => n.data.nodeType === filterType)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter((n) => n.data.title.toLowerCase().includes(q))
    }
    return result
  }, [nodes, filterType, searchQuery])

  const visibleNodeIds = useMemo(
    () => new Set(filteredNodes.map((n) => n.id)),
    [filteredNodes],
  )

  const filteredEdges = useMemo(
    () => edges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)),
    [edges, visibleNodeIds],
  )

  // --- Edge creation via drag-connect ---
  const [pendingConnection, setPendingConnection] = useState<{
    sourceNodeId: number
    targetNodeId: number
  } | null>(null)

  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (!connection.source || !connection.target) return

      // Block connections from company nodes only in workspace scope
      if (scope === 'workspace') {
        const sourceNode = nodes.find((n) => n.id === connection.source)
        if (sourceNode?.data.isCompanyNode) return
      }

      setPendingConnection({
        sourceNodeId: Number(connection.source),
        targetNodeId: Number(connection.target),
      })
    },
    [nodes, scope],
  )

  const clearPendingConnection = useCallback(() => setPendingConnection(null), [])

  // Flush pending position save on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        const currentNodes = nodesRef.current
        if (currentNodes.length > 0) {
          const positions = currentNodes.map((n) => ({
            node_id: n.data.nodeId,
            position_x: n.position.x,
            position_y: n.position.y,
          }))
          batchPositions.mutate({ positions })
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    nodes: filteredNodes,
    allNodes: nodes,
    edges: filteredEdges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    pendingConnection,
    clearPendingConnection,
    filterType,
    setFilterType,
    searchQuery,
    setSearchQuery,
    setNodes,
    savePositions,
    isLoading,
    isError,
  }
}
