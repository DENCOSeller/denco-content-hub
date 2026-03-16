/**
 * Temporary manual API for transcription.
 * TODO: Remove after regenerating hey-api client with transcription endpoints.
 */

import { client } from '@/api/client/client.gen'

export interface TranscriptionSegment {
  start: number
  end: number
  text: string
  speaker?: string | null
}

export interface TranscriptionResponse {
  id: number
  content_item_id: number
  status: string
  text: string | null
  language: string | null
  duration_seconds: number | null
  segments: TranscriptionSegment[] | null
  whisper_model: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export async function getTranscriptionApi(
  workspaceId: number,
  contentId: number,
): Promise<TranscriptionResponse> {
  const result = await client.get({
    url: '/api/v1/workspaces/{workspace_id}/content/{content_id}/transcription',
    path: {
      workspace_id: workspaceId,
      content_id: contentId,
    },
    throwOnError: true,
  })
  return result.data as TranscriptionResponse
}
