'use client'

import { useState } from 'react'
import { Avatar } from '@mantine/core'
import { IconSparkles, IconSearch, IconFileImport, IconCheck } from '@tabler/icons-react'
import type { ChatMessage, AiAction } from '@/hooks/useAiChat'
import { parseMessageContent } from '@/lib/chat-message-parser'
import { markdownToHtml } from '@/lib/markdown-to-html'
import { NodeReference } from './NodeReference'
import { AiActionCard } from './AiActionCard'
import { AiToolProgress } from './AiToolProgress'
import { ChatAttachmentChip } from './ChatAttachmentChip'
import styles from './AiChatMessage.module.css'

interface AiChatMessageProps {
  message: ChatMessage
  workspaceId?: number
  companyId?: number
  onApplyAction?: (messageId: string, action: AiAction) => Promise<boolean>
  onRejectAction?: (messageId: string, actionId: string) => void
  onInsertToEditor?: (text: string) => void
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function pluralizeSearch(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} поиск`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} поиска`
  return `${n} поисков`
}

function RenderContent({ content, workspaceId, companyId, streaming }: { content: string; workspaceId?: number; companyId?: number; streaming?: boolean }) {
  const segments = parseMessageContent(content)
  const hasNodeRefs = segments.some((s) => s.type === 'node_ref')
  const cursor = streaming ? <span className={styles.streamingCursor} /> : null

  if (!hasNodeRefs) {
    return (
      <div className={styles.content}>
        <span dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }} />
        {cursor}
      </div>
    )
  }

  return (
    <div className={styles.content}>
      {segments.map((segment, i) =>
        segment.type === 'text' ? (
          <span key={i} dangerouslySetInnerHTML={{ __html: markdownToHtml(segment.content) }} />
        ) : (
          <NodeReference
            key={i}
            id={segment.id}
            nodeType={segment.nodeType}
            title={segment.title}
            workspaceId={workspaceId}
            companyId={companyId}
          />
        ),
      )}
      {cursor}
    </div>
  )
}

export function AiChatMessageItem({ message, workspaceId, companyId, onApplyAction, onRejectAction, onInsertToEditor }: AiChatMessageProps) {
  const isUser = message.role === 'user'
  const [inserted, setInserted] = useState(false)

  return (
    <div className={`${styles.row} ${isUser ? styles.userRow : styles.assistantRow}`}>
      {!isUser && (
        <div className={styles.avatar}>
          <Avatar size={30} radius="xl" variant="gradient" gradient={{ from: 'contentHubTeal', to: 'teal.3', deg: 135 }}>
            <IconSparkles size={14} />
          </Avatar>
        </div>
      )}
      <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.assistantBubble}`}>
        {isUser ? (
          <>
            {message.attachments && message.attachments.length > 0 && (
              <div className={styles.attachments}>
                {message.attachments.map((att) => (
                  <ChatAttachmentChip
                    key={att.id}
                    name={att.original_name}
                    size={att.size_bytes}
                    contentType={att.content_type}
                  />
                ))}
              </div>
            )}
            {message.content && (
              <div className={styles.content} dangerouslySetInnerHTML={{ __html: markdownToHtml(message.content) }} />
            )}
          </>
        ) : (
          <>
            <RenderContent content={message.content} workspaceId={workspaceId} companyId={companyId} />
            {message.actions?.map((action) => (
              <AiActionCard
                key={action.id}
                action={action}
                onApply={() => onApplyAction?.(message.id, action) ?? Promise.resolve(false)}
                onReject={() => onRejectAction?.(message.id, action.id)}
              />
            ))}
          </>
        )}
        <div className={styles.messageFooter}>
          {!isUser && message.tool_rounds && message.tool_rounds > 0 && (
            <ToolRoundsBadge count={message.tool_rounds} />
          )}
          {!isUser && onInsertToEditor && message.content && (
            <button
              type="button"
              className={`${styles.insertBtn} ${inserted ? styles.insertBtnDone : ''}`}
              onClick={() => {
                onInsertToEditor(message.content)
                setInserted(true)
              }}
              disabled={inserted}
            >
              {inserted ? (
                <><IconCheck size={12} /> Применено</>
              ) : (
                <><IconFileImport size={12} /> Вставить в редактор</>
              )}
            </button>
          )}
          <span className={styles.time}>{formatTime(message.created_at)}</span>
        </div>
      </div>
      {isUser && (
        <div className={styles.avatar}>
          <Avatar size={30} radius="xl" variant="gradient" gradient={{ from: 'contentHubTeal', to: 'teal.8', deg: 135 }}>
            U
          </Avatar>
        </div>
      )}
    </div>
  )
}

function ToolRoundsBadge({ count }: { count: number }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <button
      type="button"
      className={`${styles.toolRoundsBadge} ${expanded ? styles.toolRoundsBadgeExpanded : ''}`}
      onClick={() => setExpanded((v) => !v)}
    >
      <IconSearch size={12} />
      <span>{pluralizeSearch(count)}</span>
    </button>
  )
}

interface StreamingMessageProps {
  content: string
  actions?: AiAction[]
  toolProgress?: string[]
  workspaceId?: number
  companyId?: number
  onApplyAction?: (messageId: string, action: AiAction) => Promise<boolean>
  onRejectAction?: (messageId: string, actionId: string) => void
}

export function AiStreamingMessage({ content, actions, toolProgress, workspaceId, companyId, onApplyAction, onRejectAction }: StreamingMessageProps) {
  const showToolProgress = toolProgress && toolProgress.length > 0

  return (
    <div className={`${styles.row} ${styles.assistantRow}`}>
      <div className={styles.avatar}>
        <Avatar size={30} radius="xl" variant="gradient" gradient={{ from: 'contentHubTeal', to: 'teal.3', deg: 135 }}>
          <IconSparkles size={14} />
        </Avatar>
      </div>
      <div className={`${styles.bubble} ${styles.assistantBubble}`}>
        {showToolProgress && <AiToolProgress tools={toolProgress} />}
        {content ? (
          <RenderContent content={content} workspaceId={workspaceId} companyId={companyId} streaming />
        ) : (
          !showToolProgress && (
            <div className={styles.typingIndicator}>
              <span className={styles.dot} />
              <span className={styles.dot} />
              <span className={styles.dot} />
            </div>
          )
        )}
        {actions?.map((action) => (
          <AiActionCard
            key={action.id}
            action={action}
            onApply={() => onApplyAction?.('streaming', action) ?? Promise.resolve(false)}
            onReject={() => onRejectAction?.('streaming', action.id)}
          />
        ))}
      </div>
    </div>
  )
}

