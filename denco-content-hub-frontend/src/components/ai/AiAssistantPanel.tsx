'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { ActionIcon, Badge, Text, Stack, Tooltip } from '@mantine/core'
import { IconX, IconSparkles, IconMapPin, IconHistory, IconUpload } from '@tabler/icons-react'

import { useAiPanelStore, MIN_PANEL_WIDTH, MAX_PANEL_WIDTH } from '@/stores/ai-panel-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useAiPageContext } from '@/contexts/AiPageContext'
import type { AiPageContext } from '@/contexts/AiPageContext'
import { useAiChat } from '@/hooks/useAiChat'
import { useAiActions } from '@/hooks/useAiActions'
import type { AttachedFile, AiChatInputHandle } from './AiChatInput'
import { ACCEPTED_MIME_TYPES, AiChatInput } from './AiChatInput'
import { useSessionMessagesQuery } from '@/api/hooks/useAiSessions'
import { AiChatMessageItem, AiStreamingMessage } from './AiChatMessage'
import { AiSuggestionCards } from './AiSuggestionCards'
import { ChatSessionList } from './ChatSessionList'
import styles from './AiAssistantPanel.module.css'

function getContextLabel(ctx: AiPageContext): string {
  switch (ctx.page_type) {
    case 'dashboard':
      return 'Главная'
    case 'workspace':
      return ctx.workspace_name ? `Воркспейс — ${ctx.workspace_name}` : 'Воркспейс'
    case 'workspace_knowledge':
      return 'Граф знаний'
    case 'company_knowledge':
      return 'Граф знаний компании'
    case 'content_item':
      return 'Контент'
    default:
      return ''
  }
}

export function AiAssistantPanel() {
  const close = useAiPanelStore((s) => s.close)
  const activeSessionId = useAiPanelStore((s) => s.activeSessionId)
  const setActiveSessionId = useAiPanelStore((s) => s.setActiveSessionId)
  const setPanelWidth = useAiPanelStore((s) => s.setPanelWidth)
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)
  const pageContext = useAiPageContext()

  const [showSessionList, setShowSessionList] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollBottomRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<AiChatInputHandle>(null)
  const dragCounterRef = useRef(0)

  const handleSessionCreated = useCallback(
    (id: string) => {
      setActiveSessionId(id)
    },
    [setActiveSessionId],
  )

  const {
    messages,
    isStreaming,
    streamingContent,
    streamingActions,
    toolProgress,
    sendMessage,
    setMessages,
    updateActionStatus,
    stopStreaming,
    resetChat,
  } = useAiChat({
    sessionId: activeSessionId,
    onSessionCreated: handleSessionCreated,
  })

  const { applyAction, rejectAction } = useAiActions({
    workspaceId: pageContext?.workspace_id,
    companyId: pageContext?.company_id,
    updateActionStatus,
  })

  // Load history when session changes
  const { data: historyMessages } = useSessionMessagesQuery(activeWorkspace?.id, activeSessionId)

  useEffect(() => {
    if (historyMessages && historyMessages.length > 0 && messages.length === 0) {
      setMessages(historyMessages)
    }
  }, [historyMessages, messages.length, setMessages])

  // Auto-scroll to bottom on new messages / streaming
  useEffect(() => {
    scrollBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, streamingContent, streamingActions.length, toolProgress.length])

  const handleSend = useCallback(
    (content: string, files?: AttachedFile[]) => {
      sendMessage(content, pageContext, files)
    },
    [sendMessage, pageContext],
  )

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      if (sessionId === activeSessionId) {
        setShowSessionList(false)
        return
      }
      resetChat()
      setActiveSessionId(sessionId)
      setShowSessionList(false)
    },
    [activeSessionId, resetChat, setActiveSessionId],
  )

  const handleNewChat = useCallback(() => {
    resetChat()
    setActiveSessionId(null)
    setShowSessionList(false)
  }, [resetChat, setActiveSessionId])

  // --- Resize handle ---
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsResizing(true)
      const startX = e.clientX
      const startWidth = useAiPanelStore.getState().panelWidth

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = startX - moveEvent.clientX
        const newWidth = startWidth + delta
        setPanelWidth(Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, newWidth)))
      }

      const handleMouseUp = () => {
        setIsResizing(false)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [setPanelWidth],
  )

  // --- Drag & Drop ---
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current += 1
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current -= 1
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0
      setIsDragOver(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files).filter((f) =>
      ACCEPTED_MIME_TYPES.includes(f.type),
    )
    if (files.length > 0) {
      chatInputRef.current?.addFiles(files)
    }
  }, [])

  const hasMessages = messages.length > 0 || isStreaming

  return (
    <div
      className={`${styles.panel} ${isResizing ? styles.panelResizing : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Resize handle on left edge */}
      <div
        className={styles.resizeHandle}
        onMouseDown={handleResizeStart}
        role="separator"
        aria-orientation="vertical"
        aria-label="Изменить ширину панели"
      >
        <div className={styles.resizeHandleLine} />
      </div>

      {isDragOver && (
        <div className={styles.dragOverlay}>
          <div className={styles.dragOverlayContent}>
            <IconUpload size={32} />
            <span className={styles.dragOverlayText}>Перетащите файлы сюда</span>
          </div>
        </div>
      )}

      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <div className={styles.sparkleIcon}>
            <IconSparkles size={18} />
          </div>
          <Text size="sm" fw={600} className={styles.headerText}>
            AI Ассистент
          </Text>
        </div>
        <div className={styles.headerActions}>
          <Tooltip label="История чатов" position="bottom" withArrow>
            <ActionIcon
              variant="subtle"
              size="sm"
              className={styles.headerButton}
              onClick={() => setShowSessionList((v) => !v)}
              aria-label="История чатов"
            >
              <IconHistory size={16} />
            </ActionIcon>
          </Tooltip>
          <ActionIcon
            variant="subtle"
            size="sm"
            className={styles.closeButton}
            onClick={close}
            aria-label="Закрыть панель"
          >
            <IconX size={16} />
          </ActionIcon>
        </div>
      </div>

      {pageContext && (
        <div className={styles.contextBar}>
          <Badge
            variant="light"
            color="contentHubTeal"
            size="sm"
            leftSection={<IconMapPin size={12} />}
            className={styles.contextBadge}
          >
            {getContextLabel(pageContext)}
          </Badge>
        </div>
      )}

      <div className={styles.body} ref={scrollRef}>
        {hasMessages ? (
          <div className={styles.messageList}>
            {messages.map((msg) => (
              <AiChatMessageItem
                key={msg.id}
                message={msg}
                workspaceId={pageContext?.workspace_id}
                companyId={pageContext?.company_id}
                onApplyAction={applyAction}
                onRejectAction={rejectAction}
              />
            ))}
            {isStreaming && (
              <AiStreamingMessage
                content={streamingContent}
                actions={streamingActions.length > 0 ? streamingActions : undefined}
                toolProgress={toolProgress.length > 0 ? toolProgress : undefined}
                workspaceId={pageContext?.workspace_id}
                companyId={pageContext?.company_id}
                onApplyAction={applyAction}
                onRejectAction={rejectAction}
              />
            )}
            <div ref={scrollBottomRef} />
          </div>
        ) : (
          <Stack className={styles.placeholder} gap="xs">
            <div className={styles.placeholderIcon}>
              <IconSparkles size={28} />
            </div>
            <Text size="md" fw={500} className={styles.placeholderTitle}>
              Привет! Я твой AI ассистент
            </Text>
            <Text size="sm" c="dimmed" mb="md">
              Эксперт по маркетингу и контент-стратегии DENCO. Задай вопрос или
              выбери действие.
            </Text>
            <AiSuggestionCards onSelect={handleSend} />
          </Stack>
        )}
      </div>

      <AiChatInput
        ref={chatInputRef}
        onSend={handleSend}
        onStop={stopStreaming}
        isStreaming={isStreaming}
      />

      {showSessionList && (
        <ChatSessionList
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onClose={() => setShowSessionList(false)}
        />
      )}
    </div>
  )
}
