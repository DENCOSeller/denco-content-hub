// ---------------------------------------------------------------------------
// Content Intelligence — TypeScript types matching backend schemas
// ---------------------------------------------------------------------------

export interface KeyPoint {
  point: string
  importance: string | null
}

export interface IntelligenceHook {
  hook: string
  explanation: string
}

export interface ContentIdea {
  idea: string
  angle: string
}

export interface ContentStructure {
  format: string
  has_cta: boolean
  cta_type: string | null
  opening_style: string | null
}

export interface StoryboardEntry {
  topic: string
  purpose: string
  time_start: string | null
  time_end: string | null
  block_number: number | null
}

export interface AudienceInsight {
  insight: string
  recommendation: string | null
}

export interface ProductionNote {
  note: string
  category: string | null
}

export interface TopicTag {
  name: string
  category: string | null
}

export type IntelligenceStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'

export type IntelligenceSourceType = 'reference' | 'competitor_post' | 'trend_item'

export interface IntelligenceResponse {
  id: number
  workspace_id: number
  source_type: IntelligenceSourceType
  content_item_id: number | null
  competitor_post_id: number | null
  trend_item_id: number | null

  summary: string | null
  key_points: KeyPoint[] | null
  hooks: IntelligenceHook[] | null
  topics: TopicTag[] | null
  tone: string | null
  quality_score: number | null
  content_ideas: ContentIdea[] | null
  content_structure: ContentStructure | null
  storyboard: StoryboardEntry[] | null
  audience_insights: AudienceInsight[] | null
  production_notes: ProductionNote[] | null

  status: IntelligenceStatus
  error_message: string | null
  model_used: string | null
  prompt_version: string | null
  sections_requested: string[] | null
  created_at: string
  updated_at: string
}
