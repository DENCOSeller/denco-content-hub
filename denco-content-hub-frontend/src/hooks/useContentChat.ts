'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAccessToken } from '@/lib/auth'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'

export interface ContentChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

interface SSEEvent {
  type: 'token' | 'text_delta' | 'done' | 'error'
  content?: string
  delta?: string
  text?: string
  message_id?: number
  detail?: string
}

interface UseContentChatReturn {
  messages: ContentChatMessage[]
  isStreaming: boolean
  streamingContent: string
  sendMessage: (content: string) => Promise<void>
  stopStreaming: () => void
  isHistoryLoading: boolean
}

function useChatHistoryQuery(workspaceId: number, contentId: number) {
  return useQuery<ContentChatMessage[]>({
    queryKey: ['content-chat', workspaceId, contentId],
    queryFn: async () => {
      const token = getAccessToken()
      const response = await fetch(
        `${API_BASE_URL}/api/v1/workspaces/${workspaceId}/content/${contentId}/chat`,
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      )

      if (!response.ok) {
        throw new Error(`Failed to load chat history: ${response.status}`)
      }

      const data = await response.json()
      return data.messages ?? data
    },
    enabled: !!workspaceId && !!contentId,
    staleTime: Infinity,
  })
}

export function useContentChat(
  workspaceId: number,
  contentId: number,
): UseContentChatReturn {
  const [messages, setMessages] = useState<ContentChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const abortControllerRef = useRef<AbortController | null>(null)
  const historyLoadedRef = useRef(false)

  const {
    data: history,
    isLoading: isHistoryLoading,
  } = useChatHistoryQuery(workspaceId, contentId)

  useEffect(() => {
    if (history && !historyLoadedRef.current) {
      historyLoadedRef.current = true
      if (history.length > 0) {
        setMessages(history)
      }
    }
  }, [history])

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
  }, [])

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (isStreaming || !trimmed) return

      const userMessage: ContentChatMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: trimmed,
        created_at: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, userMessage])
      setIsStreaming(true)
      setStreamingContent('')

      const abortController = new AbortController()
      abortControllerRef.current = abortController
      let accumulated = ''

      try {
        const token = getAccessToken()
        const response = await fetch(
          `${API_BASE_URL}/api/v1/workspaces/${workspaceId}/content/${contentId}/chat`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'text/event-stream',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ message: trimmed }),
            signal: abortController.signal,
          },
        )

        if (!response.ok) {
          throw new Error(`SSE request failed: ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No readable stream')
        }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue

            const jsonStr = line.slice(6)
            try {
              const event = JSON.parse(jsonStr) as SSEEvent

              if ((event.type === 'token' || event.type === 'text_delta') && (event.content || event.delta || event.text)) {
                const text = event.content ?? event.delta ?? event.text ?? ''
                accumulated += text
                setStreamingContent(accumulated)
              } else if (event.type === 'done') {
                const assistantMessage: ContentChatMessage = {
                  id: String(event.message_id ?? `done-${Date.now()}`),
                  role: 'assistant',
                  content: accumulated,
                  created_at: new Date().toISOString(),
                }
                setMessages((prev) => [...prev, assistantMessage])
                setStreamingContent('')
              } else if (event.type === 'error') {
                throw new Error(event.detail ?? 'Ошибка AI')
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue
              throw e
            }
          }
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          if (accumulated.length > 0) {
            const partialMessage: ContentChatMessage = {
              id: `partial-${Date.now()}`,
              role: 'assistant',
              content: accumulated,
              created_at: new Date().toISOString(),
            }
            setMessages((prev) => [...prev, partialMessage])
          }
          setStreamingContent('')
        } else {
          const errorMessage: ContentChatMessage = {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: 'Произошла ошибка при получении ответа. Попробуйте ещё раз.',
            created_at: new Date().toISOString(),
          }
          setMessages((prev) => [...prev, errorMessage])
          setStreamingContent('')
        }
      } finally {
        setIsStreaming(false)
        abortControllerRef.current = null
      }
    },
    [isStreaming, workspaceId, contentId],
  )

  return {
    messages,
    isStreaming,
    streamingContent,
    sendMessage,
    stopStreaming,
    isHistoryLoading,
  }
}
