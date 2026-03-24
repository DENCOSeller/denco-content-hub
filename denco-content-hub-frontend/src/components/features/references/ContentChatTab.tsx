'use client'

import { useRef, useEffect, useCallback, type KeyboardEvent } from 'react'
import {
  Avatar,
  Text,
  TextInput,
  ActionIcon,
} from '@mantine/core'
import { IconSend, IconPlayerStop, IconSparkles } from '@tabler/icons-react'
import { useContentChat, type ContentChatMessage } from '@/hooks/useContentChat'
import { markdownToHtml } from '@/lib/markdown-to-html'
import { LoadingState } from '@/components/shared/LoadingState'
import styles from './content-chat.module.css'

interface ContentChatTabProps {
  workspaceId: number
  contentId: number
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function MessageBubble({ message }: { message: ContentChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={`${styles.row} ${isUser ? styles.userRow : styles.assistantRow}`}>
      {!isUser && (
        <Avatar size={30} radius="xl" variant="gradient" gradient={{ from: 'contentHubTeal', to: 'teal', deg: 135 }}>
          <IconSparkles size={14} />
        </Avatar>
      )}
      <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.assistantBubble}`}>
        <div
          className={styles.content}
          dangerouslySetInnerHTML={{ __html: markdownToHtml(message.content) }}
        />
        <span className={styles.time}>{formatTime(message.created_at)}</span>
      </div>
      {isUser && (
        <Avatar size={30} radius="xl" variant="gradient" gradient={{ from: 'contentHubTeal', to: 'neonViolet', deg: 135 }}>
          U
        </Avatar>
      )}
    </div>
  )
}

function StreamingBubble({ content }: { content: string }) {
  return (
    <div className={`${styles.row} ${styles.assistantRow}`}>
      <Avatar size={30} radius="xl" variant="gradient" gradient={{ from: 'contentHubTeal', to: 'teal', deg: 135 }}>
        <IconSparkles size={14} />
      </Avatar>
      <div className={`${styles.bubble} ${styles.assistantBubble}`}>
        {content ? (
          <div className={styles.content}>
            <span dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }} />
            <span className={styles.streamingCursor} />
          </div>
        ) : (
          <div className={styles.typingIndicator}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
        )}
      </div>
    </div>
  )
}

export function ContentChatTab({ workspaceId, contentId }: ContentChatTabProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollBottomRef = useRef<HTMLDivElement>(null)

  const {
    messages,
    isStreaming,
    streamingContent,
    sendMessage,
    stopStreaming,
    isHistoryLoading,
  } = useContentChat(workspaceId, contentId)

  useEffect(() => {
    scrollBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, streamingContent])

  const handleSend = useCallback(() => {
    const value = inputRef.current?.value ?? ''
    if (!value.trim() || isStreaming) return
    sendMessage(value)
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }, [sendMessage, isStreaming])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  if (isHistoryLoading) {
    return <LoadingState message="Загрузка чата..." />
  }

  const hasMessages = messages.length > 0 || isStreaming

  return (
    <div className={styles.container}>
      {hasMessages ? (
        <div className={styles.messageArea}>
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isStreaming && <StreamingBubble content={streamingContent} />}
          <div ref={scrollBottomRef} />
        </div>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <IconSparkles size={24} style={{ color: 'var(--content-hub-teal)' }} />
          </div>
          <Text size="md" fw={500} c="gray.3">
            AI Чат по контенту
          </Text>
          <Text size="sm" c="dimmed" ta="center" maw={320}>
            Задайте вопрос по этому контенту — AI проанализирует транскрипцию и ответит
          </Text>
        </div>
      )}

      <div className={styles.inputBar}>
        <TextInput
          ref={inputRef}
          placeholder="Задайте вопрос по контенту..."
          onKeyDown={handleKeyDown}
          disabled={isHistoryLoading}
          rightSection={
            isStreaming ? (
              <ActionIcon
                variant="subtle"
                color="red"
                onClick={stopStreaming}
                aria-label="Остановить"
              >
                <IconPlayerStop size={18} />
              </ActionIcon>
            ) : (
              <ActionIcon
                variant="subtle"
                color="contentHubTeal"
                onClick={handleSend}
                aria-label="Отправить"
              >
                <IconSend size={18} />
              </ActionIcon>
            )
          }
          styles={{
            input: {
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
            },
          }}
        />
      </div>
    </div>
  )
}
