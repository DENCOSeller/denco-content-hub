'use client'

import { useCallback } from 'react'
import { ActionIcon, Text } from '@mantine/core'
import { IconArrowLeft, IconPlus, IconTrash, IconMessage } from '@tabler/icons-react'
import { useSessionsListQuery, useDeleteSessionMutation } from '@/api/hooks/useAiSessions'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { ChatSession } from '@/api/hooks/useAiSessions'
import styles from './ChatSessionList.module.css'

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'только что'
  if (diffMin < 60) return `${diffMin} мин назад`
  if (diffHours < 24) return `${diffHours} ч назад`
  if (diffDays < 7) return `${diffDays} дн назад`
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

interface ChatSessionListProps {
  activeSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onNewChat: () => void
  onClose: () => void
}

export function ChatSessionList({
  activeSessionId,
  onSelectSession,
  onNewChat,
  onClose,
}: ChatSessionListProps) {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)
  const { data: sessions, isLoading } = useSessionsListQuery(activeWorkspace?.id)
  const deleteMutation = useDeleteSessionMutation(activeWorkspace?.id)

  const handleDelete = useCallback(
    (e: React.MouseEvent, session: ChatSession) => {
      e.stopPropagation()
      deleteMutation.mutate(session.id)
    },
    [deleteMutation],
  )

  return (
    <div className={styles.overlay}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <ActionIcon variant="subtle" size="sm" onClick={onClose} aria-label="Назад">
            <IconArrowLeft size={16} />
          </ActionIcon>
          <Text size="sm" fw={600} c="gray.2">
            История чатов
          </Text>
        </div>
      </div>

      <button type="button" className={styles.newChatButton} onClick={onNewChat}>
        <IconPlus size={16} />
        Новый чат
      </button>

      <div className={styles.list}>
        {isLoading && (
          <div className={styles.emptyState}>Загрузка...</div>
        )}

        {!isLoading && (!sessions || sessions.length === 0) && (
          <div className={styles.emptyState}>Нет сохранённых чатов</div>
        )}

        {sessions?.map((session) => (
          <button
            key={session.id}
            type="button"
            className={`${styles.sessionItem} ${
              session.id === activeSessionId ? styles.sessionItemActive : ''
            }`}
            onClick={() => onSelectSession(session.id)}
          >
            <IconMessage size={16} style={{ flexShrink: 0, opacity: 0.5 }} />
            <div className={styles.sessionInfo}>
              <div className={styles.sessionTitle}>
                {session.title || 'Новый чат'}
              </div>
              <div className={styles.sessionDate}>
                {formatRelativeDate(session.updated_at)}
              </div>
            </div>
            <button
              type="button"
              className={styles.deleteButton}
              onClick={(e) => handleDelete(e, session)}
              aria-label="Удалить чат"
            >
              <IconTrash size={14} />
            </button>
          </button>
        ))}
      </div>
    </div>
  )
}
