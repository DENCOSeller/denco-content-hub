'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  useStoreApi,
  type NodeMouseHandler,
} from '@xyflow/react'
import { Box, Stack, Text, Center, Skeleton, Button, Group, Drawer, Tabs } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMediaQuery } from '@mantine/hooks'
import { IconPlus, IconCategory, IconArrowsExchange } from '@tabler/icons-react'

import { KnowledgeNodeCard } from './KnowledgeNodeCard'
import { KnowledgeEdgeCustom } from './KnowledgeEdgeCustom'
import { KnowledgeToolbar } from './KnowledgeToolbar'
import { CreateNodeModal } from './CreateNodeModal'
import { CreateEdgeModal } from './CreateEdgeModal'
import { NodeEditorDrawer } from './NodeEditorDrawer'
import { NodeListView } from './NodeListView'
import { ConflictBanner } from './ConflictBanner'
import { ConflictModal } from './ConflictModal'
import { NodeTypeManager } from './NodeTypeManager'
import { EdgeTypeManager } from './EdgeTypeManager'
import { useKnowledgeGraph, type KnowledgeScope } from '@/hooks/useKnowledgeGraph'
import { useDeleteNodeMutation } from '@/api/hooks/useKnowledge'
import { useCompanyDeleteNodeMutation } from '@/api/hooks/useCompanyKnowledge'
import { useKgConflicts } from '@/api/hooks/useKgConflicts'
import { ErrorState } from '@/components/shared/ErrorState'
import { applyDagreLayout, applyForceLayout, animateNodePositions } from '@/lib/graph-layout'

export interface KnowledgeGraphProps {
  scope: KnowledgeScope
  scopeId: number
}

function LoadingSkeleton() {
  return (
    <Stack gap="md" p="md" style={{ flex: 1 }}>
      <Skeleton height={44} radius={10} />
      <Skeleton height="100%" radius={10} style={{ flex: 1 }} />
    </Stack>
  )
}

function EmptyGraphState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <Center style={{ flex: 1, cursor: 'pointer' }} onClick={onCreateClick}>
      <Stack align="center" gap="xs">
        <Box
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: 'rgba(130, 130, 220, 0.08)',
            border: '1.5px dashed var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconPlus size={24} color="var(--text-muted)" />
        </Box>
        <Text c="dimmed" size="sm">Граф пуст — нажмите, чтобы создать первый узел</Text>
      </Stack>
    </Center>
  )
}

/** Desktop: ReactFlow canvas with toolbar */
function DesktopGraphView({ scope, scopeId }: KnowledgeGraphProps) {
  const {
    nodes, allNodes, edges, onNodesChange, onEdgesChange,
    onConnect, pendingConnection, clearPendingConnection,
    filterType, setFilterType, filterStatus, setFilterStatus,
    searchQuery, setSearchQuery,
    setNodes, savePositions,
    isLoading, isError,
  } = useKnowledgeGraph(scopeId, scope)

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null)
  const [conflictModalOpen, setConflictModalOpen] = useState(false)
  const [typesDrawerOpen, setTypesDrawerOpen] = useState(false)

  const { data: conflicts } = useKgConflicts(scope === 'workspace' ? scopeId : 0)

  const workspaceDelete = useDeleteNodeMutation(scope === 'workspace' ? scopeId : 0)
  const companyDelete = useCompanyDeleteNodeMutation(scope === 'company' ? scopeId : 0)
  const deleteMutation = scope === 'workspace' ? workspaceDelete : companyDelete

  const { getNodes, fitView: reactFlowFitView } = useReactFlow()
  const storeApi = useStoreApi()

  const cancelAnimationRef = useRef<(() => void) | null>(null)
  const previousPositionsRef = useRef<Map<string, { x: number; y: number }> | null>(null)
  const previousNodesRef = useRef<typeof allNodes | null>(null)
  const [pinnedNodeIds, setPinnedNodeIds] = useState<Set<string>>(new Set())

  const handleTogglePin = useCallback((nodeId: string) => {
    setPinnedNodeIds((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }, [])

  const captureMeasuredMap = useCallback(() => {
    const { nodeLookup } = storeApi.getState()
    const measured = new Map<string, { width?: number; height?: number }>()
    for (const [id, internal] of nodeLookup) {
      if (internal.measured) measured.set(id, internal.measured)
    }
    return measured
  }, [storeApi])

  const handleUndoLayout = useCallback(() => {
    if (!previousPositionsRef.current || !previousNodesRef.current) return
    const prevPositions = previousPositionsRef.current
    const snapshotNodes = previousNodesRef.current

    const restoredNodes = snapshotNodes.map((n) => {
      const prev = prevPositions.get(n.id)
      if (!prev) return n
      return { ...n, position: prev }
    })

    cancelAnimationRef.current?.()
    const measured = captureMeasuredMap()
    cancelAnimationRef.current = animateNodePositions(
      allNodes,
      restoredNodes,
      setNodes,
      300,
      () => {
        reactFlowFitView({ padding: 0.2, duration: 200 })
        savePositions(restoredNodes)
      },
      measured,
    )

    previousPositionsRef.current = null
    previousNodesRef.current = null
    notifications.hide('layout-undo')
  }, [allNodes, setNodes, savePositions, reactFlowFitView, captureMeasuredMap])

  const undoRef = useRef(handleUndoLayout)
  undoRef.current = handleUndoLayout

  const handleAutoLayout = useCallback((algorithm: 'dagre' | 'force') => {
    cancelAnimationRef.current?.()

    previousPositionsRef.current = new Map(allNodes.map((n) => [n.id, { x: n.position.x, y: n.position.y }]))
    previousNodesRef.current = [...allNodes]

    const pinned = pinnedNodeIds

    const layoutNodes = algorithm === 'dagre'
      ? applyDagreLayout(allNodes, edges, pinned)
      : applyForceLayout(allNodes, edges, pinned)

    const measured = captureMeasuredMap()
    cancelAnimationRef.current = animateNodePositions(
      allNodes,
      layoutNodes,
      setNodes,
      300,
      () => {
        reactFlowFitView({ padding: 0.2, duration: 200 })
        savePositions(layoutNodes)
      },
      measured,
    )

    notifications.show({
      id: 'layout-undo',
      message: (
        <Group gap="xs" justify="space-between">
          <Text size="sm">Раскладка применена</Text>
          <Button size="xs" variant="subtle" onClick={() => undoRef.current()}>
            Отменить
          </Button>
        </Group>
      ),
      autoClose: 5000,
      withCloseButton: true,
      color: 'blue',
    })
  }, [allNodes, edges, pinnedNodeIds, setNodes, savePositions, reactFlowFitView, captureMeasuredMap])

  const nodesWithPinState = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          isPinned: pinnedNodeIds.has(n.id),
          onTogglePin: () => handleTogglePin(n.id),
        },
      })),
    [nodes, pinnedNodeIds, handleTogglePin],
  )

  const nodeTypes = useMemo(() => ({ knowledgeCard: KnowledgeNodeCard }), [])
  const edgeTypes = useMemo(() => ({ knowledgeEdge: KnowledgeEdgeCustom }), [])

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      const nodeId = node.data.nodeId as number
      setSelectedNodeId(nodeId)
    },
    [],
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (selectedNodeId !== null) return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selectedNodes = getNodes().filter((n) => n.selected)
        if (selectedNodes.length !== 1) return
        const node = selectedNodes[0]
        const nodeId = (node.data as { nodeId: number }).nodeId
        const title = (node.data as { title: string }).title

        if (window.confirm(`Удалить узел «${title}»? Все связи тоже будут удалены.`)) {
          deleteMutation.mutate(nodeId)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedNodeId, getNodes, deleteMutation])

  if (isLoading) return <LoadingSkeleton />
  if (isError) return <ErrorState message="Не удалось загрузить граф знаний" />

  const isEmpty = allNodes.length === 0

  return (
    <Stack gap={0} style={{ width: '100%', height: 'calc(100vh - 140px)' }}>
      <Box style={{ position: 'relative', zIndex: 5 }}>
        <KnowledgeToolbar
          scope={scope}
          scopeId={scopeId}
          filterType={filterType}
          onFilterChange={setFilterType}
          filterStatus={filterStatus}
          onFilterStatusChange={setFilterStatus}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onCreateClick={() => setCreateModalOpen(true)}
          onAutoLayout={handleAutoLayout}
          onManageTypes={scope === 'company' ? () => setTypesDrawerOpen(true) : undefined}
        />
      </Box>

      <ConflictBanner
        conflictCount={conflicts?.length ?? 0}
        onReviewClick={() => setConflictModalOpen(true)}
      />

      <Box style={{ flex: 1, minHeight: 0, height: '100%' }}>
        {isEmpty ? (
          <EmptyGraphState onCreateClick={() => setCreateModalOpen(true)} />
        ) : (
          <ReactFlow
            nodes={nodesWithPinState}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable
            fitView
            fitViewOptions={{ padding: 0.2, maxZoom: 1.5 }}
            proOptions={{ hideAttribution: true }}
            minZoom={0.1}
            maxZoom={3}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255, 255, 255, 0.03)" />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              nodeColor={(node) => {
                const data = node.data as { color?: string }
                return data.color ?? '#8E8E93'
              }}
              maskColor="rgba(0, 0, 0, 0.8)"
              style={{
                width: 160,
                height: 100,
                backgroundColor: 'rgba(30, 30, 58, 0.95)',
                borderRadius: 8,
                border: '1px solid var(--border-subtle)',
              }}
            />
          </ReactFlow>
        )}
      </Box>

      <CreateNodeModal
        scope={scope}
        scopeId={scopeId}
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />

      <CreateEdgeModal
        scope={scope}
        scopeId={scopeId}
        sourceNodeId={pendingConnection?.sourceNodeId ?? null}
        targetNodeId={pendingConnection?.targetNodeId ?? null}
        opened={!!pendingConnection}
        onClose={clearPendingConnection}
      />

      <NodeEditorDrawer
        scope={scope}
        scopeId={scopeId}
        nodeId={selectedNodeId}
        opened={selectedNodeId !== null}
        onClose={() => setSelectedNodeId(null)}
      />

      <ConflictModal
        opened={conflictModalOpen}
        onClose={() => setConflictModalOpen(false)}
        conflicts={conflicts ?? []}
        workspaceId={scope === 'workspace' ? scopeId : 0}
      />

      {scope === 'company' && (
        <Drawer
          opened={typesDrawerOpen}
          onClose={() => setTypesDrawerOpen(false)}
          position="right"
          size={560}
          title="Управление типами"
          overlayProps={{ backgroundOpacity: 0.4, blur: 4 }}
        >
          <Tabs defaultValue="node-types">
            <Tabs.List mb="md">
              <Tabs.Tab value="node-types" leftSection={<IconCategory size={16} />}>
                Типы узлов
              </Tabs.Tab>
              <Tabs.Tab value="edge-types" leftSection={<IconArrowsExchange size={16} />}>
                Типы связей
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="node-types">
              <NodeTypeManager companyId={scopeId} />
            </Tabs.Panel>
            <Tabs.Panel value="edge-types">
              <EdgeTypeManager companyId={scopeId} />
            </Tabs.Panel>
          </Tabs>
        </Drawer>
      )}
    </Stack>
  )
}

/** Mobile: card list with inline filter/search */
function MobileListView({ scope, scopeId }: KnowledgeGraphProps) {
  const {
    nodes, filterType, setFilterType, searchQuery, setSearchQuery,
    isLoading, isError,
  } = useKnowledgeGraph(scopeId, scope)

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null)

  if (isLoading) return <LoadingSkeleton />
  if (isError) return <ErrorState message="Не удалось загрузить граф знаний" />

  const listNodes = nodes.map((n) => ({
    nodeId: n.data.nodeId as number,
    title: n.data.title as string,
    nodeType: n.data.nodeType as string,
    preview: (n.data.contentPreview as string) || undefined,
  }))

  return (
    <Stack gap={0} style={{ width: '100%', height: 'calc(100vh - 140px)' }}>
      <NodeListView
        nodes={listNodes}
        filterType={filterType}
        onFilterChange={setFilterType}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onNodeSelect={setSelectedNodeId}
        onCreateClick={() => setCreateModalOpen(true)}
      />

      <CreateNodeModal
        scope={scope}
        scopeId={scopeId}
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />

      <NodeEditorDrawer
        scope={scope}
        scopeId={scopeId}
        nodeId={selectedNodeId}
        opened={selectedNodeId !== null}
        onClose={() => setSelectedNodeId(null)}
      />
    </Stack>
  )
}

export function KnowledgeGraph(props: KnowledgeGraphProps) {
  const isMobile = useMediaQuery('(max-width: 48em)')

  // Avoid hydration mismatch — render nothing until media query resolves
  if (isMobile === undefined) return <LoadingSkeleton />

  if (isMobile) {
    return <MobileListView {...props} />
  }

  return (
    <ReactFlowProvider>
      <DesktopGraphView {...props} />
    </ReactFlowProvider>
  )
}
