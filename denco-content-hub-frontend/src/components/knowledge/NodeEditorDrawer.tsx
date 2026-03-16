'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import dynamic from 'next/dynamic'
import {
  Drawer,
  Badge,
  Text,
  Timeline,
  Loader,
  SegmentedControl,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { IconTrash } from '@tabler/icons-react'

import {
  useNodeQuery,
  useUpdateNodeMutation,
  useDeleteNodeMutation,
  useNodeVersionsQuery,
  useWorkspaceGraphQuery,
} from '@/api/hooks/useKnowledge'
import {
  useCompanyNodeQuery,
  useCompanyUpdateNodeMutation,
  useCompanyDeleteNodeMutation,
  useCompanyNodeVersionsQuery,
  useCompanyGraphQuery,
} from '@/api/hooks/useCompanyKnowledge'
import { getNodeTypeConfig } from '@/lib/knowledge-utils'
import { markdownToHtml } from '@/lib/markdown-to-html'
import type { KnowledgeScope } from '@/hooks/useKnowledgeGraph'

import { EditorToolbar } from './EditorToolbar'
import { NodeAiChat } from './NodeAiChat'
import styles from './NodeEditorDrawer.module.css'

const TipTapEditor = dynamic(
  () => import('./TipTapEditor').then((m) => ({ default: m.TipTapEditor })),
  { ssr: false, loading: () => <Loader size="sm" /> },
)

interface NodeEditorDrawerProps {
  scope: KnowledgeScope
  scopeId: number
  nodeId: number | null
  opened: boolean
  onClose: () => void
}

const CHANGE_TYPE_LABELS: Record<string, string> = {
  created: 'Создано',
  updated: 'Обновлено',
  ai_created: 'Создано AI',
  ai_updated: 'Обновлено AI',
}

const CHANGE_TYPE_ICONS: Record<string, string> = {
  created: '✨',
  updated: '✏️',
  ai_created: '🤖',
  ai_updated: '🤖',
}

type SaveState = 'saved' | 'saving' | 'dirty' | 'idle'

export function NodeEditorDrawer({ scope, scopeId, nodeId, opened, onClose }: NodeEditorDrawerProps) {
  const [internalNodeId, setInternalNodeId] = useState(nodeId)

  // Reset internal navigation when external nodeId changes
  useEffect(() => {
    setInternalNodeId(nodeId)
  }, [nodeId])

  const activeNodeId = internalNodeId ?? 0
  const isNavigated = internalNodeId !== nodeId

  // Workspace hooks
  const wsNode = useNodeQuery(scope === 'workspace' ? scopeId : 0, scope === 'workspace' ? activeNodeId : 0)
  const wsVersions = useNodeVersionsQuery(scope === 'workspace' ? scopeId : 0, scope === 'workspace' ? activeNodeId : 0)
  const wsUpdate = useUpdateNodeMutation(scope === 'workspace' ? scopeId : 0)
  const wsDelete = useDeleteNodeMutation(scope === 'workspace' ? scopeId : 0)

  // Company hooks
  const coNode = useCompanyNodeQuery(scope === 'company' ? scopeId : 0, scope === 'company' ? activeNodeId : 0)
  const coVersions = useCompanyNodeVersionsQuery(scope === 'company' ? scopeId : 0, scope === 'company' ? activeNodeId : 0)
  const coUpdate = useCompanyUpdateNodeMutation(scope === 'company' ? scopeId : 0)
  const coDelete = useCompanyDeleteNodeMutation(scope === 'company' ? scopeId : 0)

  // Graph hooks (cached — no extra request)
  const wsGraph = useWorkspaceGraphQuery(scope === 'workspace' ? scopeId : 0)
  const coGraph = useCompanyGraphQuery(scope === 'company' ? scopeId : 0)
  const graphData = scope === 'workspace' ? wsGraph.data : coGraph.data

  const nodeQuery = scope === 'workspace' ? wsNode : coNode
  const versionsQuery = scope === 'workspace' ? wsVersions : coVersions
  const updateMutation = scope === 'workspace' ? wsUpdate : coUpdate
  const deleteMutation = scope === 'workspace' ? wsDelete : coDelete

  const { data: node, isLoading } = nodeQuery
  const { data: versions } = versionsQuery

  // Compute connected nodes from graph edges
  const connectedNodes = useMemo(() => {
    if (!graphData || !activeNodeId) return []
    const nodeMap = new Map(graphData.nodes.map((n) => [n.id, n]))
    return graphData.edges
      .filter((e) =>
        (e.source_node_id === activeNodeId || e.target_node_id === activeNodeId) &&
        e.source_node_id !== e.target_node_id
      )
      .map((e) => {
        const isSource = e.source_node_id === activeNodeId
        const connectedId = isSource ? e.target_node_id : e.source_node_id
        const connectedNode = nodeMap.get(connectedId)
        if (!connectedNode) return null
        return {
          edgeId: e.id,
          nodeId: connectedId,
          title: connectedNode.title,
          nodeType: connectedNode.node_type as string,
          label: e.label,
          direction: isSource ? ('outgoing' as const) : ('incoming' as const),
        }
      })
      .filter(Boolean) as Array<{
        edgeId: number
        nodeId: number
        title: string
        nodeType: string
        label: string
        direction: 'outgoing' | 'incoming'
      }>
  }, [graphData, activeNodeId])

  const editorRef = useRef<Editor | null>(null)

  const handleEditorReady = useCallback((editor: Editor | null) => {
    editorRef.current = editor
  }, [])

  const handleInsertToEditor = useCallback(
    (text: string) => {
      const editor = editorRef.current
      if (!editor) return
      const html = markdownToHtml(text)
      editor.chain().focus().insertContentAt(editor.state.doc.content.size - 1, html).run()
    },
    [],
  )

  const handleReplaceEditorContent = useCallback(
    (text: string) => {
      const editor = editorRef.current
      if (!editor) return
      const html = markdownToHtml(text)
      editor.commands.setContent(html || { type: 'doc', content: [{ type: 'paragraph' }] })
    },
    [],
  )

  const [title, setTitle] = useState('')
  const [content, setContent] = useState<Record<string, unknown> | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync state when node data loads
  useEffect(() => {
    if (node) {
      setTitle(node.title)
      setContent((node.content as Record<string, unknown>) ?? null)
      setIsDirty(false)
      setConfirmDelete(false)
      setSaveState('saved')
    }
  }, [node])

  // Reset on close
  useEffect(() => {
    if (!opened) {
      setConfirmDelete(false)
      setShowHistory(false)
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [opened])

  const doSave = useCallback(
    (t: string, c: Record<string, unknown> | null) => {
      if (!activeNodeId) return
      setSaveState('saving')
      updateMutation.mutate(
        { nodeId: activeNodeId, data: { title: t, content: c } },
        {
          onSuccess: () => {
            setIsDirty(false)
            setSaveState('saved')
          },
        },
      )
    },
    [activeNodeId, updateMutation],
  )

  const handleContentChange = useCallback(
    (json: Record<string, unknown>) => {
      setContent(json)
      setIsDirty(true)
      setSaveState('dirty')
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        doSave(title, json)
      }, 2000)
    },
    [title, doSave],
  )

  const handleToolbarTitleChange = useCallback(
    (newTitle: string) => {
      setTitle(newTitle)
      setIsDirty(true)
      setSaveState('dirty')
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        doSave(newTitle, content)
      }, 2000)
    },
    [content, doSave],
  )

  const handleDelete = useCallback(() => {
    if (!activeNodeId) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    deleteMutation.mutate(activeNodeId, { onSuccess: onClose })
  }, [activeNodeId, confirmDelete, deleteMutation, onClose])

  // Keyboard shortcuts: Cmd/Ctrl+S to save, Escape to close
  useEffect(() => {
    if (!opened) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (activeNodeId && isDirty) {
          if (debounceRef.current) clearTimeout(debounceRef.current)
          doSave(title, content)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [opened, activeNodeId, isDirty, title, content, onClose, doSave])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const isMobile = useMediaQuery('(max-width: 767px)')
  const [activePanel, setActivePanel] = useState<'editor' | 'chat'>('editor')

  const typeConfig = node ? getNodeTypeConfig(node.node_type as string) : null

  const saveStatusText =
    saveState === 'saving'
      ? 'Сохранение...'
      : saveState === 'saved'
        ? 'Сохранено'
        : saveState === 'dirty'
          ? 'Не сохранено'
          : ''

  return (
    <>
      <Drawer
        opened={opened}
        onClose={() => {
          if (debounceRef.current) {
            clearTimeout(debounceRef.current)
            if (activeNodeId && isDirty) {
              updateMutation.mutate({ nodeId: activeNodeId, data: { title, content } })
            }
          }
          onClose()
        }}
        position="right"
        size={isMobile ? '100%' : 960}
        withCloseButton
        className={styles.drawer}
        title=""
        overlayProps={{ backgroundOpacity: 0.4, blur: 4 }}
      >
        {isLoading || !node ? (
          <div className={styles.loadingWrapper}>
            <Loader />
          </div>
        ) : (
          <>
            {/* ── Toolbar ── */}
            <EditorToolbar
              title={title}
              isNavigated={isNavigated}
              saveState={saveState}
              onBack={() => setInternalNodeId(nodeId)}
              onTitleChange={handleToolbarTitleChange}
              onHistoryClick={() => setShowHistory(true)}
              onSave={() => {
                if (activeNodeId && isDirty) {
                  if (debounceRef.current) clearTimeout(debounceRef.current)
                  doSave(title, content)
                }
              }}
              onClose={() => {
                if (debounceRef.current) {
                  clearTimeout(debounceRef.current)
                  if (activeNodeId && isDirty) {
                    updateMutation.mutate({ nodeId: activeNodeId, data: { title, content } })
                  }
                }
                onClose()
              }}
            />

            {/* ── Split layout ── */}
            <div className={styles.splitLayout}>
              {/* Left: Editor */}
              <div
                className={styles.splitLeft}
                style={isMobile && activePanel !== 'editor' ? { display: 'none' } : undefined}
              >
                <div className={styles.editorContent}>
                  <TipTapEditor
                    content={content}
                    onChange={handleContentChange}
                    onEditorReady={handleEditorReady}
                    accentGradient={typeConfig?.gradient}
                    placeholder="Начните описывать этот узел..."
                    borderless
                  />
                </div>

                {/* Relations */}
                {connectedNodes.length > 0 && (
                  <div className={styles.relationsSection}>
                    <div className={styles.relationsHeader}>
                      Связи ({connectedNodes.length})
                    </div>
                    <div className={styles.relationsList}>
                      {connectedNodes.map((rel) => {
                        const relConfig = getNodeTypeConfig(rel.nodeType)
                        const RelIcon = relConfig.icon
                        return (
                          <button
                            key={rel.edgeId}
                            type="button"
                            className={styles.relationRow}
                            onClick={() => setInternalNodeId(rel.nodeId)}
                          >
                            <RelIcon size={14} color={relConfig.color} stroke={1.8} />
                            <span className={styles.relationTitle}>{rel.title}</span>
                            <span className={styles.relationArrow}>
                              {rel.direction === 'outgoing' ? '→' : '←'}
                            </span>
                            <span className={styles.relationLabel}>{rel.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className={styles.footer}>
                  <div
                    className={`${styles.saveStatus} ${
                      saveState === 'saved'
                        ? styles.saveStatusSaved
                        : saveState === 'saving'
                          ? styles.saveStatusSaving
                          : styles.saveStatusDirty
                    }`}
                  >
                    <div
                      className={`${styles.saveDot} ${
                        saveState === 'saved'
                          ? styles.saveDotSaved
                          : saveState === 'saving'
                            ? styles.saveDotSaving
                            : styles.saveDotDirty
                      }`}
                    />
                    <span>{saveStatusText}</span>
                  </div>

                  <button
                    type="button"
                    className={`${styles.deleteBtn} ${confirmDelete ? styles.deleteBtnConfirm : ''}`}
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                  >
                    <IconTrash size={14} stroke={1.8} />
                    {confirmDelete ? 'Подтвердить' : 'Удалить'}
                  </button>
                </div>
              </div>

              {/* Divider (hidden on mobile) */}
              {!isMobile && <div className={styles.splitDivider} />}

              {/* Right: AI Chat */}
              <div
                className={styles.splitRight}
                style={isMobile && activePanel !== 'chat' ? { display: 'none' } : undefined}
              >
                <NodeAiChat
                  scope={scope}
                  scopeId={scopeId}
                  nodeId={activeNodeId}
                  nodeTitle={title}
                  nodeType={(node?.node_type as string) ?? 'note'}
                  connectedCount={connectedNodes.length}
                  onInsertToEditor={handleInsertToEditor}
                  onReplaceEditorContent={handleReplaceEditorContent}
                />
              </div>
            </div>

            {/* ── Mobile panel switcher ── */}
            {isMobile && (
              <div className={styles.mobileSwitcher}>
                <SegmentedControl
                  value={activePanel}
                  onChange={(val) => setActivePanel(val as 'editor' | 'chat')}
                  data={[
                    { label: 'Редактор', value: 'editor' },
                    { label: 'AI Чат', value: 'chat' },
                  ]}
                  fullWidth
                  size="sm"
                />
              </div>
            )}
          </>
        )}
      </Drawer>

      {/* ── History drawer ── */}
      <Drawer
        opened={showHistory}
        onClose={() => setShowHistory(false)}
        title="История версий"
        position="right"
        size={isMobile ? '100%' : 420}
        withOverlay={false}
        className={styles.historyModal}
      >
        <div className={styles.historyPanel}>
          {versions && versions.length > 0 ? (
            <Timeline active={0} bulletSize={24} lineWidth={1}>
              {versions.map((v) => (
                <Timeline.Item
                  key={v.id}
                  bullet={
                    <span style={{ fontSize: 12 }}>
                      {CHANGE_TYPE_ICONS[v.change_type] ?? '📝'}
                    </span>
                  }
                >
                  <div className={styles.versionTitle}>
                    v{v.version_number}
                    <Badge
                      size="xs"
                      variant="light"
                      color="gray"
                      ml={8}
                      className={styles.versionBadge}
                    >
                      {CHANGE_TYPE_LABELS[v.change_type] ?? v.change_type}
                    </Badge>
                  </div>
                  <Text className={styles.versionMeta}>
                    {v.title}
                    {v.change_summary ? ` — ${v.change_summary}` : ''}
                  </Text>
                  <Text className={styles.versionMeta}>
                    {new Date(v.created_at).toLocaleString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </Timeline.Item>
              ))}
            </Timeline>
          ) : (
            <div className={styles.historyEmpty}>
              История версий пуста
            </div>
          )}
        </div>
      </Drawer>
    </>
  )
}
