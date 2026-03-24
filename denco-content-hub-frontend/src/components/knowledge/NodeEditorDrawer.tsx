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
  TextInput,
  Select,
  Textarea,
  Stack,
  SimpleGrid,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'

import {
  useNodeQuery,
  useUpdateNodeMutation,
  useDeleteNodeMutation,
  useNodeVersionsQuery,
  useWorkspaceGraphQuery,
} from '@/api/hooks/useKnowledge'
import {
  useOrganizationNodeQuery,
  useOrganizationUpdateNodeMutation,
  useOrganizationDeleteNodeMutation,
  useOrganizationNodeVersionsQuery,
  useOrganizationGraphQuery,
} from '@/api/hooks/useOrganizationKnowledge'
import { getNodeTypeConfig } from '@/lib/knowledge-utils'
import { markdownToHtml } from '@/lib/markdown-to-html'
import type { KnowledgeScope } from '@/hooks/useKnowledgeGraph'

import { EditorToolbar } from './EditorToolbar'
import { PropertyBar } from './PropertyBar'
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

const SPEAKER_STYLE_OPTIONS = [
  { value: 'expert', label: 'Экспертный' },
  { value: 'lively', label: 'Живой' },
  { value: 'provocative', label: 'Провокационный' },
  { value: 'motivational', label: 'Мотивационный' },
  { value: 'analytical', label: 'Аналитический' },
  { value: 'conversational', label: 'Разговорный' },
]

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
  const coNode = useOrganizationNodeQuery(scope === 'company' ? scopeId : 0, scope === 'company' ? activeNodeId : 0)
  const coVersions = useOrganizationNodeVersionsQuery(scope === 'company' ? scopeId : 0, scope === 'company' ? activeNodeId : 0)
  const coUpdate = useOrganizationUpdateNodeMutation(scope === 'company' ? scopeId : 0)
  const coDelete = useOrganizationDeleteNodeMutation(scope === 'company' ? scopeId : 0)

  // Graph hooks (cached — no extra request)
  const wsGraph = useWorkspaceGraphQuery(scope === 'workspace' ? scopeId : 0)
  const coGraph = useOrganizationGraphQuery(scope === 'company' ? scopeId : 0)
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
          nodeType: (connectedNode.node_type_def?.slug ?? 'note') as string,
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

  // Provenance fields
  const [nodeStatus, setNodeStatus] = useState<string>('active')
  const [confidence, setConfidence] = useState<number>(1)
  const [source, setSource] = useState<string>('')

  // Refs for provenance — always up-to-date, no stale closures
  const nodeStatusRef = useRef(nodeStatus)
  const confidenceRef = useRef(confidence)
  const sourceRef = useRef(source)

  // Sync state when node data loads
  useEffect(() => {
    if (node) {
      setTitle(node.title)
      setContent((node.content as Record<string, unknown>) ?? null)
      const s = node.status ?? 'active'
      const parsed = parseFloat(node.confidence ?? '')
      const c = Number.isNaN(parsed) ? 1 : parsed
      const src = node.source ?? ''
      setNodeStatus(s)
      setConfidence(c)
      setSource(src)
      nodeStatusRef.current = s
      confidenceRef.current = c
      sourceRef.current = src
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
        {
          nodeId: activeNodeId,
          data: {
            title: t,
            content: c,
            status: nodeStatusRef.current,
            confidence: String(confidenceRef.current),
            source: sourceRef.current || null,
          },
        },
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

  const handleSpeakerFieldChange = useCallback(
    (field: string, value: string | null) => {
      const updated = { ...(content ?? {}), [field]: value ?? '' }
      setContent(updated)
      setIsDirty(true)
      setSaveState('dirty')
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        doSave(title, updated)
      }, 2000)
    },
    [title, content, doSave],
  )

  const handleProvenanceChange = useCallback(
    (field: 'status' | 'confidence' | 'source', value: string | number | null) => {
      if (field === 'status') {
        const v = value as string
        setNodeStatus(v)
        nodeStatusRef.current = v
      } else if (field === 'confidence') {
        const v = value as number
        setConfidence(v)
        confidenceRef.current = v
      } else if (field === 'source') {
        const v = (value as string) ?? ''
        setSource(v)
        sourceRef.current = v
      }

      setIsDirty(true)
      setSaveState('dirty')
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        doSave(title, content)
      }, 2000)
    },
    [title, content, doSave],
  )

  const isSpeaker = node?.node_type_def?.slug === 'speaker'

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

  const typeConfig = node ? getNodeTypeConfig(node.node_type_def?.slug ?? 'note') : null

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
              updateMutation.mutate({
                nodeId: activeNodeId,
                data: {
                  title,
                  content,
                  status: nodeStatusRef.current,
                  confidence: String(confidenceRef.current),
                  source: sourceRef.current || null,
                },
              })
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
              onClose={() => {
                if (debounceRef.current) {
                  clearTimeout(debounceRef.current)
                  if (activeNodeId && isDirty) {
                    updateMutation.mutate({
                      nodeId: activeNodeId,
                      data: {
                        title,
                        content,
                        status: nodeStatusRef.current,
                        confidence: String(confidenceRef.current),
                        source: sourceRef.current || null,
                      },
                    })
                  }
                }
                onClose()
              }}
            />

            {/* ── PropertyBar ── */}
            <PropertyBar
              status={nodeStatus}
              confidence={confidence}
              ownerRole={node.owner_role}
              source={source}
              lastReviewed={node.last_reviewed}
              connectedNodes={connectedNodes}
              onStatusChange={(val) => handleProvenanceChange('status', val)}
              onConfidenceChange={(val) => { setConfidence(val); confidenceRef.current = val }}
              onConfidenceChangeEnd={(val) => handleProvenanceChange('confidence', val)}
              onSourceChange={(val) => handleProvenanceChange('source', val)}
              onNavigateToNode={(id) => setInternalNodeId(id)}
            />

            {/* ── Split layout ── */}
            <div className={styles.splitLayout}>
              {/* Left: Editor */}
              <div
                className={styles.splitLeft}
                style={isMobile && activePanel !== 'editor' ? { display: 'none' } : undefined}
              >
                <div className={styles.editorContent}>
                  {isSpeaker ? (
                    <Stack gap="sm" p="md">
                      <SimpleGrid cols={2} spacing="sm">
                        <TextInput
                          label="Должность"
                          placeholder="CEO, Маркетолог"
                          size="sm"
                          value={(content?.position as string) ?? ''}
                          onChange={(e) => handleSpeakerFieldChange('position', e.currentTarget.value)}
                        />
                        <Select
                          label="Стиль подачи"
                          placeholder="Выберите стиль"
                          size="sm"
                          data={SPEAKER_STYLE_OPTIONS}
                          value={(content?.style as string) ?? null}
                          onChange={(val) => handleSpeakerFieldChange('style', val)}
                          clearable
                        />
                      </SimpleGrid>
                      <Textarea
                        label="Особенности"
                        placeholder="Особенности спикера для написания сценариев..."
                        autosize
                        minRows={2}
                        maxRows={6}
                        value={(content?.notes as string) ?? ''}
                        onChange={(e) => handleSpeakerFieldChange('notes', e.currentTarget.value)}
                      />
                      <Textarea
                        label="Описание для AI"
                        placeholder="Инструкция для AI при генерации контента..."
                        autosize
                        minRows={2}
                        maxRows={6}
                        value={(content?.ai_description as string) ?? ''}
                        onChange={(e) => handleSpeakerFieldChange('ai_description', e.currentTarget.value)}
                      />
                      <TextInput
                        label="Фото URL"
                        placeholder="https://example.com/photo.jpg"
                        size="sm"
                        value={(content?.photo_url as string) ?? ''}
                        onChange={(e) => handleSpeakerFieldChange('photo_url', e.currentTarget.value)}
                      />
                    </Stack>
                  ) : (
                    <TipTapEditor
                      content={content}
                      onChange={handleContentChange}
                      onEditorReady={handleEditorReady}
                      accentGradient={typeConfig?.gradient}
                      placeholder="Начните писать..."
                      borderless
                    />
                  )}
                </div>

                {/* ── Connections section ── */}
                {connectedNodes.length > 0 && (
                  <div className={styles.connectionsSection}>
                    <div className={styles.connectionsSectionHeader}>
                      <span className={styles.connectionsSectionTitle}>Связи</span>
                      <span className={styles.connectionsSectionCount}>{connectedNodes.length}</span>
                    </div>
                    <div className={styles.connectionsList}>
                      {connectedNodes.map((rel) => {
                        const relConfig = getNodeTypeConfig(rel.nodeType)
                        const RelIcon = relConfig.icon
                        return (
                          <button
                            key={rel.edgeId}
                            type="button"
                            className={styles.connectionItem}
                            onClick={() => setInternalNodeId(rel.nodeId)}
                          >
                            <RelIcon size={13} color={relConfig.color} stroke={1.8} />
                            <span className={styles.connectionItemTitle}>{rel.title}</span>
                            <span className={styles.connectionItemLabel}>{rel.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Status Bar (footer) */}
                <div className={styles.statusBar}>
                  <span className={styles.statusBarText}>{saveStatusText}</span>
                  <button
                    type="button"
                    className={`${styles.statusBarDelete} ${confirmDelete ? styles.statusBarDeleteConfirm : ''}`}
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                  >
                    {confirmDelete ? 'Подтвердить удаление' : 'Удалить'}
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
                  nodeType={node?.node_type_def?.slug ?? 'note'}
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
