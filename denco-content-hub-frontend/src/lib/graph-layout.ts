import Dagre from '@dagrejs/dagre'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force'
import type { Node, Edge } from '@xyflow/react'

const NODE_WIDTH = 260
const NODE_HEIGHT = 120

export type DagreDirection = 'TB' | 'LR' | 'BT' | 'RL'

export function applyDagreLayout<N extends Record<string, unknown>, E extends Record<string, unknown>>(
  nodes: Node<N>[],
  edges: Edge<E>[],
  pinnedNodeIds?: Set<string>,
  direction: DagreDirection = 'TB',
): Node<N>[] {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80, marginx: 20, marginy: 20 })

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
    g.setEdge(edge.target, edge.source)
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
  nodeType?: string
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

export function applyClusterLayout<N extends Record<string, unknown>, E extends Record<string, unknown>>(
  nodes: Node<N>[],
  edges: Edge<E>[],
  pinnedNodeIds?: Set<string>,
): Node<N>[] {
  if (nodes.length === 0) return nodes

  // Collect unique node types and create cluster centroids arranged in a circle
  const nodeTypes = Array.from(new Set(nodes.map((n) => (n.data as { nodeType?: string }).nodeType ?? 'unknown')))
  const centroidRadius = Math.max(300, nodeTypes.length * 150)
  const centroids = new Map<string, { x: number; y: number }>()

  nodeTypes.forEach((type, i) => {
    const angle = (i / nodeTypes.length) * Math.PI * 2
    centroids.set(type, {
      x: Math.cos(angle) * centroidRadius,
      y: Math.sin(angle) * centroidRadius,
    })
  })

  const simNodes: SimNode[] = nodes.map((node) => {
    const nodeType = (node.data as { nodeType?: string }).nodeType ?? 'unknown'
    const centroid = centroids.get(nodeType)!
    const isPinned = pinnedNodeIds?.has(node.id)
    return {
      id: node.id,
      x: isPinned ? node.position.x + NODE_WIDTH / 2 : centroid.x + (Math.random() - 0.5) * 100,
      y: isPinned ? node.position.y + NODE_HEIGHT / 2 : centroid.y + (Math.random() - 0.5) * 100,
      nodeType,
      ...(isPinned
        ? {
            fx: node.position.x + NODE_WIDTH / 2,
            fy: node.position.y + NODE_HEIGHT / 2,
          }
        : {}),
    }
  })

  const simLinks: SimulationLinkDatum<SimNode>[] = edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
  }))

  // Custom cluster force — pull nodes toward their type centroid
  function forceCluster(alpha: number) {
    const strength = 0.4
    for (const node of simNodes) {
      if (node.fx != null || node.fy != null) continue
      const centroid = centroids.get(node.nodeType!)
      if (!centroid) continue
      node.vx = (node.vx ?? 0) + (centroid.x - node.x!) * strength * alpha
      node.vy = (node.vy ?? 0) + (centroid.y - node.y!) * strength * alpha
    }
  }

  const simulation = forceSimulation<SimNode>(simNodes)
    .force(
      'link',
      forceLink<SimNode, SimulationLinkDatum<SimNode>>(simLinks)
        .id((d) => d.id)
        .distance(200)
        .strength(0.3),
    )
    .force('charge', forceManyBody<SimNode>().strength(-400))
    .force('cluster', forceCluster)
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

export function applySubtreeDagreLayout<N extends Record<string, unknown>, E extends Record<string, unknown>>(
  nodes: Node<N>[],
  edges: Edge<E>[],
  rootNodeId: string,
  direction: DagreDirection,
  pinnedNodeIds?: Set<string>,
): Node<N>[] {
  // Build adjacency list (directed: source → target)
  const adjacency = new Map<string, string[]>()
  for (const edge of edges) {
    const list = adjacency.get(edge.source) ?? []
    list.push(edge.target)
    adjacency.set(edge.source, list)
  }

  // BFS from rootNodeId to find all descendants
  const subtreeIds = new Set<string>()
  const queue = [rootNodeId]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (subtreeIds.has(current)) continue
    subtreeIds.add(current)
    for (const child of adjacency.get(current) ?? []) {
      if (!subtreeIds.has(child)) queue.push(child)
    }
  }

  // Filter nodes and edges to subtree only
  const subtreeNodes = nodes.filter((n) => subtreeIds.has(n.id))
  const subtreeEdges = edges.filter((e) => subtreeIds.has(e.source) && subtreeIds.has(e.target))

  if (subtreeNodes.length === 0) return nodes

  // Find root node's current position
  const rootNode = nodes.find((n) => n.id === rootNodeId)
  if (!rootNode) return nodes

  // Apply Dagre layout to subtree
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80, marginx: 20, marginy: 20 })

  for (const node of subtreeNodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }
  for (const edge of subtreeEdges) {
    g.setEdge(edge.source, edge.target)
  }

  Dagre.layout(g)

  // Calculate offset to keep root at its current position
  const dagreRoot = g.node(rootNodeId)
  const offsetX = rootNode.position.x - (dagreRoot.x - NODE_WIDTH / 2)
  const offsetY = rootNode.position.y - (dagreRoot.y - NODE_HEIGHT / 2)

  // Build position map for subtree nodes
  const subtreePositions = new Map<string, { x: number; y: number }>()
  for (const node of subtreeNodes) {
    if (pinnedNodeIds?.has(node.id)) continue
    const dagreNode = g.node(node.id)
    subtreePositions.set(node.id, {
      x: dagreNode.x - NODE_WIDTH / 2 + offsetX,
      y: dagreNode.y - NODE_HEIGHT / 2 + offsetY,
    })
  }

  // Return all nodes — subtree nodes with new positions, rest unchanged
  return nodes.map((node) => {
    const newPos = subtreePositions.get(node.id)
    if (!newPos) return node
    return { ...node, position: newPos }
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
      requestAnimationFrame(() => onComplete?.())
    }
  }

  animationId = requestAnimationFrame(animate)
  return () => cancelAnimationFrame(animationId)
}
