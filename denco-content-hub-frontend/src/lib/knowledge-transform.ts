import type { Node, Edge } from '@xyflow/react'

import type {
  KnowledgeNodeResponse,
  KnowledgeEdgeResponse,
  KnowledgeGraphResponse,
} from '@/api/client/types.gen'
import { getNodeTypeConfig } from '@/lib/knowledge-utils'

export interface KnowledgeNodeData extends Record<string, unknown> {
  nodeId: number
  title: string
  nodeType: string
  color: string
  gradient: string
  contentPreview: string
  isCompanyNode: boolean
  isPositionFixed: boolean
  isPinned: boolean
  status: string
  confidence: number | null
  ownerRole: string | null
  source: string | null
  lastReviewed: string | null
  onTogglePin?: () => void
}

export interface KnowledgeEdgeData extends Record<string, unknown> {
  edgeId: number
  label: string
  sourceColor: string
}

export function toFlowNodes(nodes: KnowledgeNodeResponse[]): Node<KnowledgeNodeData>[] {
  return nodes.map((n) => {
    const config = getNodeTypeConfig(n.node_type)
    const preview = n.content_text?.slice(0, 80) ?? ''
    return {
      id: String(n.id),
      type: 'knowledgeCard',
      position: { x: n.position_x, y: n.position_y },
      data: {
        nodeId: n.id,
        title: n.title,
        nodeType: n.node_type,
        color: config.color,
        gradient: config.gradient,
        contentPreview: preview,
        isCompanyNode: n.scope_type === 'company',
        isPositionFixed: n.is_position_fixed,
        isPinned: false,
        status: n.status ?? 'active',
        confidence: n.confidence != null ? Number(n.confidence) : null,
        ownerRole: n.owner_role ?? null,
        source: n.source ?? null,
        lastReviewed: n.last_reviewed ?? null,
      },
    }
  })
}

export function toFlowEdges(
  edges: KnowledgeEdgeResponse[],
  nodeMap: Map<number, KnowledgeNodeResponse>,
): Edge<KnowledgeEdgeData>[] {
  return edges.map((e) => {
    const sourceNode = nodeMap.get(e.source_node_id)
    const sourceConfig = sourceNode ? getNodeTypeConfig(sourceNode.node_type) : null
    return {
      id: String(e.id),
      source: String(e.source_node_id),
      target: String(e.target_node_id),
      type: 'knowledgeEdge',
      data: {
        edgeId: e.id,
        label: e.label,
        sourceColor: sourceConfig?.color ?? '#8E8E93',
      },
    }
  })
}

export function transformGraph(graph: KnowledgeGraphResponse) {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]))
  return {
    nodes: toFlowNodes(graph.nodes),
    edges: toFlowEdges(graph.edges, nodeMap),
  }
}
