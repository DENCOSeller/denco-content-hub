'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { Text } from '@mantine/core'
import { IconSparkles, IconEye } from '@tabler/icons-react'

import { useAiChat } from '@/hooks/useAiChat'
import type { AiAction } from '@/hooks/useAiChat'
import { useAiActions } from '@/hooks/useAiActions'
import type { AttachedFile } from '@/components/ai/AiChatInput'
import { AiChatInput } from '@/components/ai/AiChatInput'
import { AiChatMessageItem, AiStreamingMessage } from '@/components/ai/AiChatMessage'
import type { KnowledgeScope } from '@/hooks/useKnowledgeGraph'
import type { AiPageContext } from '@/contexts/AiPageContext'
import styles from './NodeAiChat.module.css'

interface NodeAiChatProps {
  scope: KnowledgeScope
  scopeId: number
  nodeId: number
  nodeTitle: string
  nodeType: string
  connectedCount: number
  onInsertToEditor?: (text: string) => void
  onReplaceEditorContent?: (text: string) => void
}

const SUGGESTIONS_BY_TYPE: Record<string, string[]> = {
  target_audience: [
    'Опиши портрет ЦА',
    'Какие боли у этой аудитории?',
    'Предложи сегменты',
  ],
  meaning: [
    'Как усилить этот смысл?',
    'Предложи формулировки',
    'Как донести до аудитории?',
  ],
  channel: [
    'Оцени эффективность канала',
    'Какой контент подходит?',
    'Предложи стратегию продвижения',
  ],
  funnel: [
    'Оцени этапы воронки',
    'Где теряются лиды?',
    'Предложи улучшения конверсии',
  ],
  competitor: [
    'Какие преимущества?',
    'Сравни с нами',
    'Какие слабые стороны?',
  ],
  seo: [
    'Оцени ключевые слова',
    'Предложи SEO улучшения',
    'Какие запросы добавить?',
  ],
  brand: [
    'Оцени позиционирование',
    'Предложи tone of voice',
    'Как усилить бренд?',
  ],
  note: [
    'Расскажи подробнее об этом узле',
    'Предложи улучшения контента',
    'Какие связи можно добавить?',
  ],
  speaker: [
    'Опиши стиль подачи этого спикера',
    'Напиши вступление от лица спикера',
    'Какие темы органичны для него?',
  ],
  content_goal: [
    'Как измерить достижение этой цели?',
    'Какой контент лучше всего работает на эту цель?',
    'Предложи KPI для этой цели',
  ],
  narrative_format: [
    'Приведи пример текста в этом формате',
    'Для каких тем подходит этот нарратив?',
    'Как адаптировать под разные платформы?',
  ],
  hook_type: [
    'Напиши 3 примера хука в этом стиле',
    'Для какой аудитории работает лучше всего?',
    'Как усилить этот тип хука?',
  ],
  product_focus: [
    'Какие боли закрывает этот продукт?',
    'Предложи ключевые преимущества для контента',
    'Как рассказать об этом нативно?',
  ],
  tone_of_voice: [
    'Приведи пример текста в этом тоне',
    'Какие слова и выражения характерны?',
    'Где этот тон работает лучше всего?',
  ],
  platform: [
    'Какой формат контента лучше для этой платформы?',
    'Какова оптимальная длина поста?',
    'Какие особенности алгоритма учесть?',
  ],
  content_format: [
    'Приведи пример структуры этого формата',
    'Для каких целей подходит лучше всего?',
    'Какие ошибки чаще всего допускают?',
  ],
  hunt_level: [
    'Какой контент нужен на этом уровне осознанности?',
    'Какие возражения типичны?',
    'Как перевести аудиторию на следующий уровень?',
  ],
  audience_segment: [
    'Опиши типичного представителя этого сегмента',
    'Какие триггеры работают для этого сегмента?',
    'Как персонализировать контент под него?',
  ],
}

const DEFAULT_SUGGESTIONS = [
  'Расскажи подробнее об этом узле',
  'Предложи улучшения контента',
  'Какие связи можно добавить?',
]

function getSuggestions(nodeType: string): string[] {
  return SUGGESTIONS_BY_TYPE[nodeType] ?? DEFAULT_SUGGESTIONS
}

export function NodeAiChat({ scope, scopeId, nodeId, nodeTitle, nodeType, connectedCount, onInsertToEditor, onReplaceEditorContent }: NodeAiChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollBottomRef = useRef<HTMLDivElement>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const pageContext: AiPageContext = {
    page_type: scope === 'workspace' ? 'workspace_knowledge' : 'company_knowledge',
    ...(scope === 'workspace' ? { workspace_id: scopeId } : { company_id: scopeId }),
    focused_node_ids: [nodeId],
    current_node: {
      id: nodeId,
      title: nodeTitle,
      type: nodeType,
    },
  }

  const {
    messages,
    isStreaming,
    streamingContent,
    streamingActions,
    sendMessage,
    setMessages,
    updateActionStatus,
    stopStreaming,
  } = useAiChat({
    sessionId,
    onSessionCreated: setSessionId,
  })

  const { applyAction, rejectAction } = useAiActions({
    workspaceId: scope === 'workspace' ? scopeId : undefined,
    companyId: scope === 'company' ? scopeId : undefined,
    focusedNodeId: nodeId,
    updateActionStatus,
  })

  const handleApplyAction = useCallback(
    async (messageId: string, action: AiAction): Promise<boolean> => {
      const success = await applyAction(messageId, action)
      if (success && action.action_type === 'update_node' && onReplaceEditorContent && action.payload.content) {
        onReplaceEditorContent(action.payload.content as string)
      }
      return success
    },
    [applyAction, nodeId, onReplaceEditorContent],
  )

  useEffect(() => {
    scrollBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, streamingContent, streamingActions.length])

  // Reset when node changes
  useEffect(() => {
    setSessionId(null)
    setMessages([])
  }, [nodeId, setMessages])

  const handleSend = useCallback(
    (content: string, files?: AttachedFile[]) => {
      sendMessage(content, pageContext, files)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sendMessage, scopeId, nodeId],
  )

  const handleSuggestion = useCallback(
    (text: string) => {
      sendMessage(text, pageContext)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sendMessage, scopeId, nodeId],
  )

  const hasMessages = messages.length > 0 || isStreaming

  const suggestions = getSuggestions(nodeType)
  const pluralConnected = (n: number) => {
    const mod10 = n % 10, mod100 = n % 100
    if (mod10 === 1 && mod100 !== 11) return `${n} связанный узел`
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} связанных узла`
    return `${n} связанных узлов`
  }
  const contextLabel = connectedCount > 0
    ? `AI видит: ${nodeTitle || 'Без названия'} + ${pluralConnected(connectedCount)}`
    : `AI видит: ${nodeTitle || 'Без названия'}`

  return (
    <div className={styles.container}>
      {/* Context indicator */}
      <div className={styles.contextBar}>
        <IconEye size={14} stroke={1.8} />
        <span className={styles.contextText}>{contextLabel}</span>
      </div>

      <div className={styles.body} ref={scrollRef}>
        {hasMessages ? (
          <div className={styles.messageList}>
            {messages.map((msg) => (
              <AiChatMessageItem
                key={msg.id}
                message={msg}
                workspaceId={scope === 'workspace' ? scopeId : undefined}
                companyId={scope === 'company' ? scopeId : undefined}
                onApplyAction={handleApplyAction}
                onRejectAction={rejectAction}
                onInsertToEditor={onInsertToEditor}
              />
            ))}
            {isStreaming && (
              <AiStreamingMessage
                content={streamingContent}
                actions={streamingActions.length > 0 ? streamingActions : undefined}
                workspaceId={scope === 'workspace' ? scopeId : undefined}
                companyId={scope === 'company' ? scopeId : undefined}
                onApplyAction={handleApplyAction}
                onRejectAction={rejectAction}
              />
            )}
            <div ref={scrollBottomRef} />
          </div>
        ) : (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <IconSparkles size={24} style={{ color: 'var(--neon-blue)' }} />
            </div>
            <Text size="sm" fw={500} c="gray.3">
              Спросить AI о «{nodeTitle}»
            </Text>
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

      <AiChatInput onSend={handleSend} onStop={stopStreaming} isStreaming={isStreaming} />
    </div>
  )
}
