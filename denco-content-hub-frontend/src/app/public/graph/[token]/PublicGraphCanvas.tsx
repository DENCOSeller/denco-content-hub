'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react'

import { KnowledgeNodeCard } from '@/components/knowledge/KnowledgeNodeCard'
import { PublicKnowledgeEdge } from '@/components/knowledge/PublicKnowledgeEdge'
import type { KnowledgeNodeData, KnowledgeEdgeData } from '@/lib/knowledge-transform'
import type { KnowledgeNodeResponse } from '@/api/client/types.gen'

import { PublicNodeDrawer } from './PublicNodeDrawer'

const NODE_TYPES = { knowledgeCard: KnowledgeNodeCard }
const EDGE_TYPES = { knowledgeEdge: PublicKnowledgeEdge }

interface PublicGraphCanvasProps {
  nodes: Node<KnowledgeNodeData>[]
  edges: Edge<KnowledgeEdgeData>[]
  rawNodes: KnowledgeNodeResponse[]
}

function GraphCanvas({ nodes, edges, rawNodes }: PublicGraphCanvasProps) {
  const proOptions = useMemo(() => ({ hideAttribution: false }), [])

  const [selectedNode, setSelectedNode] = useState<KnowledgeNodeResponse | null>(null)
  const [drawerOpened, setDrawerOpened] = useState(false)

  const rawNodeMap = useMemo(
    () => new Map(rawNodes.map((n) => [n.id, n])),
    [rawNodes],
  )

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      const nodeId = (node.data as KnowledgeNodeData).nodeId
      const raw = rawNodeMap.get(nodeId)
      if (raw) {
        setSelectedNode(raw)
        setDrawerOpened(true)
      }
    },
    [rawNodeMap],
  )

  const handleDrawerClose = useCallback(() => {
    setDrawerOpened(false)
    setSelectedNode(null)
  }, [])

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        nodesDraggable={false}
        nodesConnectable={false}
        onNodeClick={handleNodeClick}
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

      <PublicNodeDrawer
        node={selectedNode}
        opened={drawerOpened}
        onClose={handleDrawerClose}
      />
    </>
  )
}

export function PublicGraphCanvas({ nodes, edges, rawNodes }: PublicGraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <div style={{ width: '100%', height: '100%' }}>
        <GraphCanvas nodes={nodes} edges={edges} rawNodes={rawNodes} />
      </div>
    </ReactFlowProvider>
  )
}
