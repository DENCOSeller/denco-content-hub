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

export function applyTreeLayout<N extends Record<string, unknown>, E extends Record<string, unknown>>(
  nodes: Node<N>[],
  edges: Edge<E>[],
  pinnedNodeIds?: Set<string>,
): Node<N>[] {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', ranksep: 100, nodesep: 80, marginx: 20, marginy: 20 })

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

export function applyMindMapLayout<N extends Record<string, unknown>, E extends Record<string, unknown>>(
  nodes: Node<N>[],
  edges: Edge<E>[],
  pinnedNodeIds?: Set<string>,
): Node<N>[] {
  if (nodes.length === 0) return nodes
  if (nodes.length === 1) {
    return nodes.map((node) => ({
      ...node,
      position: { x: -NODE_WIDTH / 2, y: -NODE_HEIGHT / 2 },
    }))
  }

  // Build adjacency structures
  const outEdges = new Map<string, string[]>()
  const inDegree = new Map<string, number>()
  const nodeIds = new Set(nodes.map((n) => n.id))

  for (const node of nodes) {
    outEdges.set(node.id, [])
    inDegree.set(node.id, 0)
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue
    outEdges.get(edge.source)!.push(edge.target)
    outEdges.get(edge.target)!.push(edge.source)
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1)
  }

  // Find root: node with no incoming edges; tie-break by max out-degree
  const rootCandidates = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0)
  let root: Node<N>
  if (rootCandidates.length === 0) {
    // Cyclic graph — pick first node
    root = nodes[0]
  } else if (rootCandidates.length === 1) {
    root = rootCandidates[0]
  } else {
    root = rootCandidates.reduce((best, candidate) =>
      (outEdges.get(candidate.id)?.length ?? 0) > (outEdges.get(best.id)?.length ?? 0) ? candidate : best,
    )
  }

  // BFS with visited set (handles cycles)
  const positions = new Map<string, { x: number; y: number }>()
  const visited = new Set<string>()
  const queue: Array<{ id: string; angle: number; spread: number; level: number }> = []

  positions.set(root.id, { x: 0, y: 0 })
  visited.add(root.id)

  const children = outEdges.get(root.id) ?? []
  const rootChildCount = children.length

  if (rootChildCount > 0) {
    const angleStep = (Math.PI * 2) / rootChildCount
    children.forEach((childId, i) => {
      if (!visited.has(childId)) {
        queue.push({ id: childId, angle: i * angleStep, spread: angleStep, level: 1 })
      }
    })
  }

  while (queue.length > 0) {
    const { id, angle, spread, level } = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)

    const radius = level * 260
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    positions.set(id, { x, y })

    const nodeChildren = (outEdges.get(id) ?? []).filter((cid) => !visited.has(cid))
    if (nodeChildren.length > 0) {
      const childSpread = Math.min(spread, (Math.PI * 2) / Math.max(nodeChildren.length, 1))
      const startAngle = angle - ((nodeChildren.length - 1) * childSpread) / 2
      nodeChildren.forEach((childId, i) => {
        queue.push({ id: childId, angle: startAngle + i * childSpread, spread: childSpread, level: level + 1 })
      })
    }
  }

  // Handle isolated nodes (not visited via BFS)
  const isolated = nodes.filter((n) => !visited.has(n.id))
  let isolatedOffsetX = 0
  const isolatedBaseY = nodes.length * 50 + 400
  for (const node of isolated) {
    positions.set(node.id, { x: isolatedOffsetX, y: isolatedBaseY })
    isolatedOffsetX += NODE_WIDTH + 40
  }

  return nodes.map((node) => {
    if (pinnedNodeIds?.has(node.id)) return node
    const pos = positions.get(node.id) ?? { x: 0, y: 0 }
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
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
      requestAnimationFrame(() => onComplete?.())
    }
  }

  animationId = requestAnimationFrame(animate)
  return () => cancelAnimationFrame(animationId)
}
