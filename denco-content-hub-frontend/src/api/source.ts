/**
 * Manual API for content source endpoint (multipart form upload).
 * TODO: Remove after regenerating hey-api client with source endpoints.
 */

import { getAccessToken } from '@/lib/auth'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'

export type SourceType = 'youtube_video' | 'pdf_file' | 'web_page' | 'manual_text'

export interface AddSourceParams {
  source_type: SourceType
  url?: string
  file?: File
  title?: string
  text?: string
}

export interface AddSourceResponse {
  id: number
  source_type: string
  status: string
  title?: string | null
  url?: string | null
  created_at: string
}

export async function addSourceApi(
  workspaceId: number,
  params: AddSourceParams,
): Promise<AddSourceResponse> {
  const formData = new FormData()
  formData.append('source_type', params.source_type)

  if (params.url) {
    formData.append('source_url', params.url)
  }
  if (params.file) {
    formData.append('file', params.file)
  }
  if (params.title) {
    formData.append('title', params.title)
  }
  if (params.text) {
    formData.append('text', params.text)
  }

  const token = getAccessToken()

  const response = await fetch(
    `${API_BASE_URL}/api/v1/workspaces/${workspaceId}/content/source`,
    {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    },
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Ошибка сервера' }))
    throw error
  }

  return response.json()
}
