'use client'

import { useMemo } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type Node,
  type Edge,
} from '@xyflow/react'

import { KnowledgeNodeCard } from '@/components/knowledge/KnowledgeNodeCard'
import { PublicKnowledgeEdge } from '@/components/knowledge/PublicKnowledgeEdge'
import type { KnowledgeNodeData, KnowledgeEdgeData } from '@/lib/knowledge-transform'

const NODE_TYPES = { knowledgeCard: KnowledgeNodeCard }
const EDGE_TYPES = { knowledgeEdge: PublicKnowledgeEdge }

interface PublicGraphCanvasProps {
  nodes: Node<KnowledgeNodeData>[]
  edges: Edge<KnowledgeEdgeData>[]
}

function GraphCanvas({ nodes, edges }: PublicGraphCanvasProps) {
  const proOptions = useMemo(() => ({ hideAttribution: false }), [])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      edgeTypes={EDGE_TYPES}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnDrag
      zoomOnScroll
      fitView
      fitViewOptions={{ padding: 0.2 }}
      proOptions={proOptions}
      style={{ width: '100%', height: '100%' }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border-subtle)" />
      <Controls showInteractive={false} />
      <MiniMap
        nodeColor={(n) => (n.data as KnowledgeNodeData).color ?? '#8E8E93'}
        maskColor="rgba(0,0,0,0.4)"
        style={{ background: 'var(--mantine-color-dark-7)' }}
      />
    </ReactFlow>
  )
}

export function PublicGraphCanvas({ nodes, edges }: PublicGraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <div style={{ width: '100%', height: '100%' }}>
        <GraphCanvas nodes={nodes} edges={edges} />
      </div>
    </ReactFlowProvider>
  )
}
