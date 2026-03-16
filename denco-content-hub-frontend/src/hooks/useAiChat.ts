'use client'

import { useState, useCallback, useRef } from 'react'
import { getAccessToken } from '@/lib/auth'
import type { AiPageContext } from '@/contexts/AiPageContext'
import type { AttachedFile } from '@/components/ai/AiChatInput'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'

export type AiActionType = 'create_node' | 'update_node' | 'create_edge'
export type AiActionStatus = 'proposed' | 'applied' | 'rejected'

export interface AiAction {
  id: string
  action_type: AiActionType
  payload: Record<string, unknown>
  status: AiActionStatus
}

export interface ChatAttachmentInfo {
  id: number
  original_name: string
  content_type: string
  size_bytes: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  actions?: AiAction[]
  attachments?: ChatAttachmentInfo[]
  tool_rounds?: number
}

interface SSEEvent {
  type: 'token' | 'done' | 'error' | 'action' | 'tool_progress'
  content?: string
  session_id?: number
  message_id?: number
  detail?: string
  action_type?: AiActionType
  payload?: Record<string, unknown>
  tool?: string
}

interface UseAiChatOptions {
  sessionId: string | null
  onSessionCreated?: (sessionId: string) => void
}

interface UseAiChatReturn {
  messages: ChatMessage[]
  isStreaming: boolean
  streamingContent: string
  streamingActions: AiAction[]
  toolProgress: string[]
  sendMessage: (content: string, pageContext: AiPageContext | null, files?: AttachedFile[]) => Promise<void>
  setMessages: (messages: ChatMessage[]) => void
  updateActionStatus: (messageId: string, actionId: string, status: AiActionStatus) => void
  stopStreaming: () => void
  resetChat: () => void
}

async function uploadFiles(files: AttachedFile[]): Promise<number[]> {
  const token = getAccessToken()
  const ids: number[] = []

  for (const { file } of files) {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${API_BASE_URL}/api/v1/ai/attachments`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    })

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      throw new Error(errData.detail || `Upload failed: ${response.status}`)
    }

    const data = await response.json()
    ids.push(data.id)
  }

  return ids
}

export function useAiChat({ sessionId, onSessionCreated }: UseAiChatOptions): UseAiChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [streamingActions, setStreamingActions] = useState<AiAction[]>([])
  const [toolProgress, setToolProgress] = useState<string[]>([])
  const abortControllerRef = useRef<AbortController | null>(null)
  const sessionIdRef = useRef(sessionId)
  sessionIdRef.current = sessionId

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
  }, [])

  const resetChat = useCallback(() => {
    stopStreaming()
    setMessages([])
    setStreamingContent('')
    setStreamingActions([])
    setToolProgress([])
    setIsStreaming(false)
  }, [stopStreaming])

  const updateActionStatus = useCallback(
    (messageId: string, actionId: string, status: AiActionStatus) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== messageId || !msg.actions) return msg
          return {
            ...msg,
            actions: msg.actions.map((a) => (a.id === actionId ? { ...a, status } : a)),
          }
        }),
      )
    },
    [],
  )

  const createSession = useCallback(async (): Promise<string> => {
    const token = getAccessToken()
    const response = await fetch(`${API_BASE_URL}/api/v1/ai/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({}),
    })

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.status}`)
    }

    const data = await response.json()
    return String(data.id)
  }, [])

  const sendMessage = useCallback(
    async (content: string, pageContext: AiPageContext | null, files?: AttachedFile[]) => {
      if (isStreaming || (!content.trim() && (!files || files.length === 0))) return

      let currentSessionId = sessionIdRef.current
      if (!currentSessionId) {
        currentSessionId = await createSession()
        sessionIdRef.current = currentSessionId
        onSessionCreated?.(currentSessionId)
      }

      // Upload files first
      let attachmentIds: number[] | undefined
      let attachmentInfos: ChatAttachmentInfo[] | undefined
      if (files && files.length > 0) {
        attachmentIds = await uploadFiles(files)
        attachmentInfos = files.map((f, i) => ({
          id: attachmentIds![i],
          original_name: f.file.name,
          content_type: f.file.type,
          size_bytes: f.file.size,
        }))
      }

      const userMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: content.trim(),
        created_at: new Date().toISOString(),
        attachments: attachmentInfos,
      }

      setMessages((prev) => [...prev, userMessage])
      setIsStreaming(true)
      setStreamingContent('')
      setStreamingActions([])
      setToolProgress([])

      const abortController = new AbortController()
      abortControllerRef.current = abortController
      let accumulated = ''
      let hasReceivedToken = false
      let toolRoundsCount = 0
      const collectedActions: AiAction[] = []

      try {
        const token = getAccessToken()
        const response = await fetch(`${API_BASE_URL}/api/v1/ai/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            session_id: Number(currentSessionId),
            message: content.trim(),
            page_context: pageContext,
            attachment_ids: attachmentIds,
          }),
          signal: abortController.signal,
        })

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

              if (event.type === 'tool_progress' && event.tool) {
                toolRoundsCount += 1
                setToolProgress((prev) => [...prev, event.tool!])
              } else if (event.type === 'token' && event.content) {
                if (!hasReceivedToken) {
                  hasReceivedToken = true
                  setToolProgress([])
                }
                accumulated += event.content
                setStreamingContent(accumulated)
              } else if (event.type === 'action' && event.action_type && event.payload) {
                const action: AiAction = {
                  id: `action-${Date.now()}-${collectedActions.length}`,
                  action_type: event.action_type,
                  payload: event.payload,
                  status: 'proposed',
                }
                collectedActions.push(action)
                setStreamingActions([...collectedActions])
              } else if (event.type === 'done') {
                const assistantMessage: ChatMessage = {
                  id: String(event.message_id ?? `done-${Date.now()}`),
                  role: 'assistant',
                  content: accumulated,
                  created_at: new Date().toISOString(),
                  actions: collectedActions.length > 0 ? collectedActions : undefined,
                  tool_rounds: toolRoundsCount > 0 ? toolRoundsCount : undefined,
                }
                setMessages((prev) => [...prev, assistantMessage])
                setStreamingContent('')
                setStreamingActions([])
                setToolProgress([])
              } else if (event.type === 'error') {
                throw new Error(event.detail ?? 'Unknown AI error')
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
            const partialMessage: ChatMessage = {
              id: `partial-${Date.now()}`,
              role: 'assistant',
              content: accumulated,
              created_at: new Date().toISOString(),
              actions: collectedActions.length > 0 ? collectedActions : undefined,
              tool_rounds: toolRoundsCount > 0 ? toolRoundsCount : undefined,
            }
            setMessages((prev) => [...prev, partialMessage])
          }
          setStreamingContent('')
          setStreamingActions([])
          setToolProgress([])
        } else {
          const errorMessage: ChatMessage = {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: 'Произошла ошибка при получении ответа. Попробуйте ещё раз.',
            created_at: new Date().toISOString(),
          }
          setMessages((prev) => [...prev, errorMessage])
          setStreamingContent('')
          setStreamingActions([])
          setToolProgress([])
        }
      } finally {
        setIsStreaming(false)
        abortControllerRef.current = null
      }
    },
    [isStreaming, createSession, onSessionCreated],
  )

  return {
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
  }
}
