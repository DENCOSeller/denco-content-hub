'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { ActionIcon, Badge, Text, Stack, Tooltip } from '@mantine/core'
import { IconX, IconSparkles, IconMapPin, IconHistory, IconUpload } from '@tabler/icons-react'

import { useAiPanelStore } from '@/stores/ai-panel-store'
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
  const pageContext = useAiPageContext()

  const [showSessionList, setShowSessionList] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
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
  const { data: historyMessages } = useSessionMessagesQuery(activeSessionId)

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
      className={styles.panel}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
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
          <IconSparkles size={20} className={styles.sparkle} />
          <Text size="sm" fw={600} c="gray.2">
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
            color="neonBlue"
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
              <IconSparkles size={28} style={{ color: 'var(--neon-blue)' }} />
            </div>
            <Text size="md" fw={500} c="gray.3">
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
