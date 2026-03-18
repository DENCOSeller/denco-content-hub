/**
 * Manual API for content analysis.
 * TODO: Remove after regenerating hey-api client with analysis endpoints.
 */

import { client } from '@/api/client/client.gen'

export type AnalysisType = 'summary' | 'theses' | 'hooks' | 'storyboard' | 'content_ideas' | 'audience_insights' | 'production_notes'

export interface ThesisItem {
  title: string
  description: string
}

export interface HookItem {
  hook: string
  explanation: string
}

export interface StoryboardItem {
  topic: string
  purpose: string
  time_start: string | null
  time_end: string | null
  block_number: number | null
}

export interface ContentIdeaItem {
  title: string
  description: string
}

/** Flat analysis response matching backend ContentAnalysisResponse. */
export interface AnalysisResponse {
  id: number
  content_item_id: number
  summary: string | null
  theses: ThesisItem[] | null
  hooks: HookItem[] | null
  storyboard: StoryboardItem[] | null
  content_ideas: ContentIdeaItem[] | null
  audience_insights: string | null
  production_notes: string | null
  status: string
  error_message: string | null
  created_at: string
  updated_at: string
}

export async function getAnalysisApi(
  workspaceId: number,
  contentId: number,
): Promise<AnalysisResponse | undefined> {
  const result = await client.get({
    url: '/api/v1/workspaces/{workspace_id}/content/{content_id}/analysis',
    path: {
      workspace_id: workspaceId,
      content_id: contentId,
    },
  })
  if (result.response.status === 404) {
    return undefined
  }
  if (result.error) {
    throw new Error((result.error as { detail?: string }).detail ?? 'Failed to load analysis')
  }
  return result.data as AnalysisResponse
}

export async function generateAnalysisApi(
  workspaceId: number,
  contentId: number,
  forceRegenerate?: boolean,
): Promise<AnalysisResponse> {
  const result = await client.post({
    url: '/api/v1/workspaces/{workspace_id}/content/{content_id}/analysis/generate',
    path: {
      workspace_id: workspaceId,
      content_id: contentId,
    },
    body: forceRegenerate ? { force_regenerate: true } : undefined,
    throwOnError: true,
  })
  return result.data as AnalysisResponse
}
