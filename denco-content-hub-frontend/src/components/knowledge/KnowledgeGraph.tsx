'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  SelectionMode,
  useReactFlow,
  useStoreApi,
  type NodeMouseHandler,
  type NodeChange,
} from '@xyflow/react'
import { ActionIcon, Box, Group, Stack, Text, Center, Skeleton, Drawer, Tabs, Paper, Tooltip, UnstyledButton } from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { useMediaQuery, useLocalStorage } from '@mantine/hooks'
import { IconPlus, IconCategory, IconArrowsExchange, IconBinaryTree, IconArrowDown, IconArrowRight, IconArrowUp, IconArrowLeft } from '@tabler/icons-react'

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
import { applyClusterLayout, applySubtreeDagreLayout, animateNodePositions, type DagreDirection } from '@/lib/graph-layout'
import type { KnowledgeNodeData } from '@/lib/knowledge-transform'
import type { Node } from '@xyflow/react'

export type DisplayMode = 'free' | 'clusters'

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
    nodes, allNodes, edges, allEdges, onNodesChange, onEdgesChange,
    onConnect, pendingConnection, clearPendingConnection,
    filterType, setFilterType, filterStatus, setFilterStatus,
    searchQuery, setSearchQuery,
    setNodes,
    savePositions,
    isLoading, isError,
  } = useKnowledgeGraph(scopeId, scope)

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null)
  const [conflictModalOpen, setConflictModalOpen] = useState(false)
  const [typesDrawerOpen, setTypesDrawerOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [nodeContextMenu, setNodeContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null)

  const { data: conflicts } = useKgConflicts(scope === 'workspace' ? scopeId : 0)

  const workspaceDelete = useDeleteNodeMutation(scope === 'workspace' ? scopeId : 0)
  const companyDelete = useCompanyDeleteNodeMutation(scope === 'company' ? scopeId : 0)
  const deleteMutation = scope === 'workspace' ? workspaceDelete : companyDelete

  const { getNodes, fitView: reactFlowFitView } = useReactFlow()
  const storeApi = useStoreApi()

  const [displayMode, setDisplayMode] = useLocalStorage<DisplayMode>({
    key: `knowledge-graph-display-mode-${scopeId}`,
    defaultValue: 'free',
  })
  // Fallback: old values (orgchart, mindmap, tree) → free
  const safeDisplayMode: DisplayMode = (displayMode === 'free' || displayMode === 'clusters') ? displayMode : 'free'
  const displayModeRef = useRef<DisplayMode>(safeDisplayMode)
  displayModeRef.current = safeDisplayMode

  const cancelAnimationRef = useRef<(() => void) | null>(null)
  const freePositionsRef = useRef<Node<KnowledgeNodeData>[] | null>(null)
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

  const handleSwitchMode = useCallback(
    (mode: DisplayMode) => {
      cancelAnimationRef.current?.()
      const measured = captureMeasuredMap()

      if (mode === 'clusters') {
        if (displayModeRef.current === 'free') {
          freePositionsRef.current = [...allNodes]
        }
        const layoutNodes = applyClusterLayout(allNodes, allEdges, pinnedNodeIds)
        cancelAnimationRef.current = animateNodePositions(
          allNodes, layoutNodes, setNodes, 300,
          () => reactFlowFitView({ padding: 0.2, duration: 200 }),
          measured,
        )
      } else {
        const restoreNodes = freePositionsRef.current ?? allNodes
        cancelAnimationRef.current = animateNodePositions(
          allNodes, restoreNodes, setNodes, 300,
          () => reactFlowFitView({ padding: 0.2, duration: 200 }),
          measured,
        )
      }

      setDisplayMode(mode)
    },
    [allNodes, allEdges, pinnedNodeIds, setNodes, reactFlowFitView, captureMeasuredMap, setDisplayMode],
  )

  const handleSubtreeOrgchart = useCallback(
    (nodeId: string, direction: DagreDirection) => {
      cancelAnimationRef.current?.()
      const measured = captureMeasuredMap()
      const layoutNodes = applySubtreeDagreLayout(allNodes, allEdges, nodeId, direction, pinnedNodeIds)
      cancelAnimationRef.current = animateNodePositions(
        allNodes, layoutNodes, setNodes, 300,
        () => {
          reactFlowFitView({ padding: 0.2, duration: 200 })
          savePositions(layoutNodes)
        },
        measured,
      )
      setNodeContextMenu(null)
    },
    [allNodes, allEdges, pinnedNodeIds, setNodes, reactFlowFitView, captureMeasuredMap, savePositions],
  )

  const handleNodesChange = useCallback(
    (changes: NodeChange<Node<KnowledgeNodeData>>[]) => {
      if (displayModeRef.current !== 'free') {
        const filtered = changes.filter((c) => !(c.type === 'position' && c.dragging === false))
        if (filtered.length > 0) onNodesChange(filtered)
        return
      }
      onNodesChange(changes)
    },
    [onNodesChange],
  )



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

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
    setNodeContextMenu(null)
  }, [])

  const handlePaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault()
    setNodeContextMenu(null)
    setContextMenu({ x: event.clientX, y: event.clientY })
  }, [])

  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node<KnowledgeNodeData>) => {
    event.preventDefault()
    setContextMenu(null)
    setNodeContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id })
  }, [])

  useEffect(() => {
    if (!contextMenu && !nodeContextMenu) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null)
        setNodeContextMenu(null)
      }
    }
    const handleScroll = () => {
      setContextMenu(null)
      setNodeContextMenu(null)
    }

    window.addEventListener('keydown', handleEscape)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      window.removeEventListener('keydown', handleEscape)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [contextMenu, nodeContextMenu])

  const nodeTypes = useMemo(() => ({ knowledgeCard: KnowledgeNodeCard }), [])
  const edgeTypes = useMemo(() => ({ knowledgeEdge: KnowledgeEdgeCustom }), [])

  const handleNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      if (event.shiftKey) return // multi-select — не открываем редактор
      const nodeId = node.data.nodeId as number
      setSelectedNodeId(nodeId)
    },
    [],
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      // Ctrl+A / Cmd+A — выделить все узлы
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault()
        setNodes((nds) => nds.map((n) => ({ ...n, selected: true })))
        return
      }

      if (selectedNodeId !== null) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selected = getNodes().filter((n) => n.selected)
        if (selected.length === 0) return

        if (selected.length === 1) {
          const node = selected[0]
          const nodeId = (node.data as { nodeId: number }).nodeId
          const title = (node.data as { title: string }).title

          modals.openConfirmModal({
            title: 'Удалить узел?',
            centered: true,
            children: (
              <Text size="sm">
                Удалить узел «{title}»? Все связи тоже будут удалены.
              </Text>
            ),
            labels: { confirm: 'Удалить', cancel: 'Отмена' },
            confirmProps: { color: 'red' },
            onConfirm: () => deleteMutation.mutate(nodeId),
          })
        } else {
          modals.openConfirmModal({
            title: 'Удалить узлы?',
            centered: true,
            children: (
              <Text size="sm">
                Удалить {selected.length} узлов? Все связи тоже будут удалены.
              </Text>
            ),
            labels: { confirm: 'Удалить', cancel: 'Отмена' },
            confirmProps: { color: 'red' },
            onConfirm: async () => {
              const results = await Promise.allSettled(
                selected.map((node) => {
                  const nodeId = (node.data as { nodeId: number }).nodeId
                  return deleteMutation.mutateAsync(nodeId)
                }),
              )
              const failed = results.filter((r) => r.status === 'rejected')
              if (failed.length > 0) {
                notifications.show({
                  title: 'Ошибка удаления',
                  message: `Не удалось удалить ${failed.length} из ${selected.length} узлов`,
                  color: 'red',
                })
              }
            },
          })
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedNodeId, getNodes, setNodes, deleteMutation])

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
          onManageTypes={scope === 'company' ? () => setTypesDrawerOpen(true) : undefined}
          displayMode={safeDisplayMode}
          onSwitchMode={handleSwitchMode}
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
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            onNodeContextMenu={handleNodeContextMenu}
            onPaneContextMenu={handlePaneContextMenu}
            onPaneClick={closeContextMenu}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable={safeDisplayMode === 'free'}
            selectionOnDrag
            multiSelectionKeyCode="Shift"
            selectionMode={SelectionMode.Partial}
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

        {contextMenu && (
          <Paper
            shadow="lg"
            radius="md"
            p={4}
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              zIndex: 1000,
              background: 'rgba(30, 30, 58, 0.95)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--border-subtle)',
              minWidth: 180,
            }}
          >
            <UnstyledButton
              onClick={() => {
                setCreateModalOpen(true)
                setContextMenu(null)
              }}
              px="sm"
              py={8}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                borderRadius: 6,
                color: 'var(--mantine-color-text)',
                fontSize: 14,
              }}
              className="context-menu-item"
            >
              <IconPlus size={16} />
              Создать узел
            </UnstyledButton>
          </Paper>
        )}

        {nodeContextMenu && (
          <Paper
            shadow="lg"
            radius="md"
            p={4}
            style={{
              position: 'fixed',
              top: nodeContextMenu.y,
              left: nodeContextMenu.x,
              zIndex: 1000,
              background: 'rgba(30, 30, 58, 0.95)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--border-subtle)',
              minWidth: 180,
            }}
          >
            <Text size="xs" c="dimmed" px="sm" py={4} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconBinaryTree size={14} />
              Орг. схема
            </Text>
            <Group gap={2} px="sm" pb={4}>
              <Tooltip label="Сверху вниз" withArrow>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  onClick={() => handleSubtreeOrgchart(nodeContextMenu.nodeId, 'TB')}
                >
                  <IconArrowDown size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Слева направо" withArrow>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  onClick={() => handleSubtreeOrgchart(nodeContextMenu.nodeId, 'LR')}
                >
                  <IconArrowRight size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Снизу вверх" withArrow>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  onClick={() => handleSubtreeOrgchart(nodeContextMenu.nodeId, 'BT')}
                >
                  <IconArrowUp size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Справа налево" withArrow>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  onClick={() => handleSubtreeOrgchart(nodeContextMenu.nodeId, 'RL')}
                >
                  <IconArrowLeft size={14} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Paper>
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
