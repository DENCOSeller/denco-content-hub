import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '@/lib/auth'
import type { ChatMessage } from '@/hooks/useAiChat'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'

function authHeaders(): Record<string, string> {
  const token = getAccessToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export interface ChatSession {
  id: string
  title: string | null
  created_at: string
  updated_at: string
}

export const aiSessionKeys = {
  all: ['ai-sessions'] as const,
  list: () => [...aiSessionKeys.all, 'list'] as const,
  detail: (id: string) => [...aiSessionKeys.all, id] as const,
  messages: (sessionId: string) => [...aiSessionKeys.all, sessionId, 'messages'] as const,
}

export function useSessionsListQuery(workspaceId: number | undefined) {
  return useQuery<ChatSession[]>({
    queryKey: [...aiSessionKeys.list(), workspaceId],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/workspaces/${workspaceId}/ai/sessions`, {
        headers: authHeaders(),
      })
      if (!response.ok) throw new Error(`Failed to fetch sessions: ${response.status}`)
      return response.json() as Promise<ChatSession[]>
    },
    enabled: !!workspaceId,
  })
}

export function useSessionMessagesQuery(workspaceId: number | undefined, sessionId: string | null) {
  return useQuery<ChatMessage[]>({
    queryKey: [...aiSessionKeys.messages(sessionId ?? ''), workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/workspaces/${workspaceId}/ai/sessions/${sessionId}/messages`,
        { headers: authHeaders() },
      )
      if (!response.ok) throw new Error(`Failed to fetch messages: ${response.status}`)
      const data = await response.json()
      // API returns array of messages; map to ChatMessage shape
      return (data as Array<Record<string, unknown>>).map((msg) => ({
        id: String(msg.id),
        role: msg.role as 'user' | 'assistant',
        content: String(msg.content),
        created_at: String(msg.created_at),
        attachments: Array.isArray(msg.attachments) && msg.attachments.length > 0
          ? msg.attachments
          : undefined,
      }))
    },
    enabled: !!sessionId && !!workspaceId,
  })
}

export function useCreateSessionMutation(workspaceId: number | undefined) {
  const qc = useQueryClient()
  return useMutation<ChatSession, Error>({
    mutationFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/workspaces/${workspaceId}/ai/sessions`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({}),
      })
      if (!response.ok) throw new Error(`Failed to create session: ${response.status}`)
      return response.json() as Promise<ChatSession>
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: aiSessionKeys.list() }),
  })
}

export function useDeleteSessionMutation(workspaceId: number | undefined) {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/workspaces/${workspaceId}/ai/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (!response.ok) throw new Error(`Failed to delete session: ${response.status}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: aiSessionKeys.list() }),
  })
}
