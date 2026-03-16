'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { Drawer, Text, ActionIcon, Group } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconSparkles, IconX, IconCheck } from '@tabler/icons-react'

import { useAiChat } from '@/hooks/useAiChat'
import { AiChatMessageItem, AiStreamingMessage } from '@/components/ai/AiChatMessage'
import { AiChatInput } from '@/components/ai/AiChatInput'
import type { AttachedFile } from '@/components/ai/AiChatInput'
import type { AiPageContext } from '@/contexts/AiPageContext'
import { useUpdateLibraryItemMutation } from '@/api/hooks/useLibrary'

import styles from './content-block-ai-panel.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BlockInfo {
  fieldName: string
  fieldLabel: string
  fieldValue: string
}

interface ContentBlockAiPanelProps {
  opened: boolean
  onClose: () => void
  block: BlockInfo | null
  workspaceId: number
  itemId: number
  contentType: string
  platform: string
  allContent: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Suggestions per block type
// ---------------------------------------------------------------------------

const SUGGESTIONS_MAP: Record<string, string[]> = {
  hook: [
    'Сделай более цепляющим',
    'Добавь интригу',
    'Сократи',
  ],
  body: [
    'Добавь эмоций',
    'Сделай более структурированным',
    'Расширь',
  ],
  description: [
    'Добавь эмоций',
    'Сократи',
    'Расширь',
  ],
  cta: [
    'Усиль призыв к действию',
    'Сделай короче и ярче',
    'Добавь срочность',
  ],
  title: [
    'Сделай более цепляющим',
    'Сократи',
    'Предложи 3 варианта',
  ],
}

const DEFAULT_SUGGESTIONS = [
  'Сделай более цепляющим',
  'Сократи',
  'Расширь',
]

function getSuggestions(fieldName: string): string[] {
  return SUGGESTIONS_MAP[fieldName] ?? DEFAULT_SUGGESTIONS
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ContentBlockAiPanel({
  opened,
  onClose,
  block,
  workspaceId,
  itemId,
  contentType,
  platform,
  allContent,
}: ContentBlockAiPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollBottomRef = useRef<HTMLDivElement>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const updateMutation = useUpdateLibraryItemMutation(workspaceId)

  const pageContext: AiPageContext = {
    page_type: 'content_item',
    workspace_id: workspaceId,
    content_item_id: itemId,
  }

  const {
    messages,
    isStreaming,
    streamingContent,
    sendMessage,
    setMessages,
    stopStreaming,
    resetChat,
  } = useAiChat({
    sessionId,
    onSessionCreated: setSessionId,
  })

  // Reset chat when block changes
  useEffect(() => {
    if (block) {
      setSessionId(null)
      resetChat()
    }
  }, [block?.fieldName, resetChat, setMessages])

  // Auto-scroll
  useEffect(() => {
    scrollBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, streamingContent])

  const buildContextMessage = useCallback(
    (userText: string): string => {
      if (!block) return userText
      const contextParts = [
        `[Контекст: платформа=${platform}, тип=${contentType}]`,
        `[Блок: ${block.fieldLabel} (${block.fieldName})]`,
        `[Текущее содержимое блока:\n${block.fieldValue}\n]`,
      ]
      return `${contextParts.join('\n')}\n\nЗапрос пользователя: ${userText}`
    },
    [block, platform, contentType],
  )

  const handleSend = useCallback(
    (content: string, files?: AttachedFile[]) => {
      const enrichedContent = buildContextMessage(content)
      sendMessage(enrichedContent, pageContext, files)
    },
    [sendMessage, buildContextMessage, pageContext],
  )

  const handleSuggestion = useCallback(
    (text: string) => {
      const enrichedContent = buildContextMessage(text)
      sendMessage(enrichedContent, pageContext)
    },
    [sendMessage, buildContextMessage, pageContext],
  )

  const handleApplyResponse = useCallback(
    (responseText: string) => {
      if (!block) return

      const updatedContent = { ...allContent, [block.fieldName]: responseText }
      updateMutation.mutate(
        { itemId, data: { edited_content: updatedContent } },
        {
          onSuccess: () => {
            notifications.show({
              title: 'Применено',
              message: `Блок «${block.fieldLabel}» обновлён`,
              color: 'green',
            })
          },
          onError: () => {
            notifications.show({
              title: 'Ошибка',
              message: 'Не удалось обновить блок',
              color: 'red',
            })
          },
        },
      )
    },
    [block, allContent, itemId, updateMutation],
  )

  const hasMessages = messages.length > 0 || isStreaming
  const suggestions = block ? getSuggestions(block.fieldName) : DEFAULT_SUGGESTIONS

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size={420}
      withCloseButton={false}
      overlayProps={{ backgroundOpacity: 0.3 }}
      classNames={{ body: styles.drawerBody, content: styles.drawerContent }}
    >
      {/* Header */}
      <div className={styles.header}>
        <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
          <IconSparkles size={16} style={{ color: 'var(--neon-blue)', flexShrink: 0 }} />
          <Text size="sm" fw={600} truncate>
            AI: Улучшить «{block?.fieldLabel ?? ''}»
          </Text>
        </Group>
        <ActionIcon variant="subtle" color="gray" size="sm" onClick={onClose}>
          <IconX size={16} />
        </ActionIcon>
      </div>

      {/* Messages / Empty */}
      <div className={styles.body} ref={scrollRef}>
        {hasMessages ? (
          <div className={styles.messageList}>
            {messages.map((msg) => (
              <div key={msg.id}>
                <AiChatMessageItem
                  message={msg}
                  workspaceId={workspaceId}
                  onInsertToEditor={
                    msg.role === 'assistant' ? handleApplyResponse : undefined
                  }
                />
                {msg.role === 'assistant' && msg.content && (
                  <ApplyButton
                    onApply={() => handleApplyResponse(msg.content)}
                    isLoading={updateMutation.isPending}
                  />
                )}
              </div>
            ))}
            {isStreaming && (
              <AiStreamingMessage content={streamingContent} workspaceId={workspaceId} />
            )}
            <div ref={scrollBottomRef} />
          </div>
        ) : (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <IconSparkles size={24} style={{ color: 'var(--neon-blue)' }} />
            </div>
            <Text size="sm" fw={500} c="gray.3" ta="center">
              Улучшить блок «{block?.fieldLabel ?? ''}»
            </Text>
            {block?.fieldValue && (
              <Text size="xs" c="dimmed" lineClamp={3} ta="center" maw={320}>
                {block.fieldValue}
              </Text>
            )}
            <div className={styles.suggestions}>
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={styles.suggestionBtn}
                  onClick={() => handleSuggestion(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <AiChatInput onSend={handleSend} onStop={stopStreaming} isStreaming={isStreaming} />
    </Drawer>
  )
}

// ---------------------------------------------------------------------------
// Apply button
// ---------------------------------------------------------------------------

function ApplyButton({ onApply, isLoading }: { onApply: () => void; isLoading: boolean }) {
  const [applied, setApplied] = useState(false)

  function handleClick() {
    if (applied) return
    onApply()
    setApplied(true)
  }

  return (
    <button
      type="button"
      className={`${styles.applyBtn} ${applied ? styles.applyBtnDone : ''}`}
      onClick={handleClick}
      disabled={isLoading || applied}
    >
      {applied ? (
        <><IconCheck size={12} /> Применено</>
      ) : (
        <><IconSparkles size={12} /> Применить</>
      )}
    </button>
  )
}
