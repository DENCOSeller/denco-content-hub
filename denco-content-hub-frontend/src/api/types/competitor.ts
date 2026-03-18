// Типы для модуля мониторинга каналов

export type CompetitorPlatform = 'youtube' | 'instagram' | 'telegram' | 'vk'

export type CompetitorChannelStatus = 'active' | 'paused' | 'error' | 'archived'

export type CompetitorAnalysisStatus =
  | 'new'
  | 'pending_analysis'
  | 'analyzing'
  | 'analyzed'
  | 'skipped'
  | 'failed'

export interface CompetitorChannel {
  id: number
  workspace_id: number
  platform: CompetitorPlatform
  source_url: string
  platform_id: string
  handle?: string
  display_name?: string
  avatar_url?: string
  description?: string
  subscribers_count?: number
  posts_count?: number
  avg_views?: number
  avg_er?: number
  status: CompetitorChannelStatus
  parse_frequency_hours: number
  last_parsed_at?: string
  error_count: number
  created_at: string
  updated_at: string
}

export interface CompetitorPost {
  id: number
  channel_id: number
  platform_post_id: string
  post_url: string
  title?: string
  description?: string
  thumbnail_url?: string
  duration_seconds?: number
  content_type?: string
  published_at: string
  views_count?: number
  likes_count?: number
  comments_count?: number
  shares_count?: number
  er_score?: number
  analysis_status: CompetitorAnalysisStatus
  sent_to_library: boolean
  created_at: string
  updated_at: string
}

export interface CompetitorAnalysis {
  id: number
  post_id: number
  transcript?: string
  summary?: string
  hooks?: Array<Record<string, unknown>>
  key_points?: string[]
  topics?: string[]
  tone?: string
  content_structure?: Record<string, unknown>
  content_ideas?: Array<Record<string, unknown>>
  quality_score?: number
  created_at: string
}

export interface CompetitorPostDetail extends CompetitorPost {
  analysis?: CompetitorAnalysis
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

export interface CompetitorPostsFilters {
  page?: number
  size?: number
  content_type?: string | null
  analysis_status?: CompetitorAnalysisStatus | null
  min_views?: number | null
}

export interface CompetitorChannelUpdate {
  status?: CompetitorChannelStatus
  parse_frequency_hours?: number
}

export interface ResolveUrlResponse {
  platform: CompetitorPlatform
  platform_id: string
  handle?: string
}

export interface SyncResponse {
  status: string
  message: string
}

export interface CompetitorChannelSnapshot {
  id: number
  channel_id: number
  recorded_at: string
  subscribers_count: number
  posts_count: number
  avg_views_30d: number
  avg_er_30d: number
  total_views_30d: number
  posts_count_30d: number
}

export type CompetitorNotificationType =
  | 'new_post'
  | 'viral_post'
  | 'channel_growth'

export interface CompetitorNotification {
  id: number
  workspace_id: number
  channel_id: number
  post_id?: number
  notification_type: CompetitorNotificationType
  title: string
  body: string
  is_read: boolean
  read_at?: string
  created_at: string
}
