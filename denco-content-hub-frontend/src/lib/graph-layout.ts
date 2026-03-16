import Dagre from '@dagrejs/dagre'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force'
import type { Node, Edge } from '@xyflow/react'

const NODE_WIDTH = 260
const NODE_HEIGHT = 120

export function applyDagreLayout<N extends Record<string, unknown>, E extends Record<string, unknown>>(
  nodes: Node<N>[],
  edges: Edge<E>[],
  pinnedNodeIds?: Set<string>,
): Node<N>[] {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80, marginx: 20, marginy: 20 })

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }

  Dagre.layout(g)

  return nodes.map((node) => {
    if (pinnedNodeIds?.has(node.id)) return node
    const dagreNode = g.node(node.id)
    return {
      ...node,
      position: {
        x: dagreNode.x - NODE_WIDTH / 2,
        y: dagreNode.y - NODE_HEIGHT / 2,
      },
    }
  })
}

interface SimNode extends SimulationNodeDatum {
  id: string
  fx?: number | null
  fy?: number | null
}

export function applyForceLayout<N extends Record<string, unknown>, E extends Record<string, unknown>>(
  nodes: Node<N>[],
  edges: Edge<E>[],
  pinnedNodeIds?: Set<string>,
): Node<N>[] {
  const simNodes: SimNode[] = nodes.map((node) => ({
    id: node.id,
    x: node.position.x + NODE_WIDTH / 2,
    y: node.position.y + NODE_HEIGHT / 2,
    ...(pinnedNodeIds?.has(node.id)
      ? {
          fx: node.position.x + NODE_WIDTH / 2,
          fy: node.position.y + NODE_HEIGHT / 2,
        }
      : {}),
  }))

  const simLinks: SimulationLinkDatum<SimNode>[] = edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
  }))

  const simulation = forceSimulation<SimNode>(simNodes)
    .force(
      'link',
      forceLink<SimNode, SimulationLinkDatum<SimNode>>(simLinks)
        .id((d) => d.id)
        .distance(200)
        .strength(0.5),
    )
    .force('charge', forceManyBody<SimNode>().strength(-800))
    .force('center', forceCenter(0, 0))
    .force(
      'collide',
      forceCollide<SimNode>()
        .radius(Math.max(NODE_WIDTH, NODE_HEIGHT) / 2 + 20)
        .strength(0.7),
    )
    .stop()

  simulation.tick(300)

  const posMap = new Map(simNodes.map((sn) => [sn.id, { x: sn.x!, y: sn.y! }]))

  return nodes.map((node) => {
    if (pinnedNodeIds?.has(node.id)) return node
    const pos = posMap.get(node.id)!
    return {
      ...node,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
    }
  })
}

export function animateNodePositions<N extends Record<string, unknown>>(
  currentNodes: Node<N>[],
  targetNodes: Node<N>[],
  setNodes: (updater: (nodes: Node<N>[]) => Node<N>[]) => void,
  duration: number = 300,
  onComplete?: () => void,
  measuredMap?: Map<string, { width?: number; height?: number }>,
): () => void {
  const startPositions = new Map(currentNodes.map((n) => [n.id, { x: n.position.x, y: n.position.y }]))
  const targetPositions = new Map(targetNodes.map((n) => [n.id, { x: n.position.x, y: n.position.y }]))

  let startTime: number | null = null
  let animationId: number

  function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3)
  }

  function animate(timestamp: number) {
    if (!startTime) startTime = timestamp
    const elapsed = timestamp - startTime
    const rawProgress = Math.min(elapsed / duration, 1)
    const progress = easeOutCubic(rawProgress)

    setNodes((prev) =>
      prev.map((node) => {
        const start = startPositions.get(node.id)
        const end = targetPositions.get(node.id)
        if (!start || !end) return node
        const measured = measuredMap?.get(node.id)
        return {
          ...node,
          position: {
            x: start.x + (end.x - start.x) * progress,
            y: start.y + (end.y - start.y) * progress,
          },
          ...(measured ? { measured } : {}),
        }
      }),
    )

    if (rawProgress < 1) {
      animationId = requestAnimationFrame(animate)
    } else {
      onComplete?.()
    }
  }

  animationId = requestAnimationFrame(animate)
  return () => cancelAnimationFrame(animationId)
}
