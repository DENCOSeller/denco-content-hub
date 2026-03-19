// Типы для модуля Trend Discovery

import type { PaginatedResponse } from './competitor'

export type TrendStage = 'rising' | 'peaking' | 'declining'

export type TrendPlatform = 'youtube' | 'instagram'

export type TrendAlertType = 'new_trend' | 'viral_trend' | 'niche_spike'

export type TrendKeywordMode = 'separate' | 'combined'

export type TrendOrientation = 'shorts' | 'long_video' | 'reels'

export type TrendAnalysisStatus =
  | 'new'
  | 'pending_analysis'
  | 'analyzing'
  | 'analyzed'
  | 'skipped'
  | 'failed'

export interface TrendItem {
  id: number
  workspace_id: number
  niche_id: number | null
  platform: TrendPlatform
  platform_post_id: string
  post_url: string | null
  title: string | null
  description: string | null
  thumbnail_url: string | null
  channel_name: string | null
  channel_url: string | null
  duration_seconds: number | null
  published_at: string | null
  detected_at: string
  views_count: number
  likes_count: number
  comments_count: number
  shares_count: number
  er_score: number | null
  velocity: number | null
  acceleration: number | null
  viral_score: number | null
  stage: TrendStage | null
  orientation: TrendOrientation | null
  competitor_post_id: number | null
  analysis_status: TrendAnalysisStatus
  created_at: string
  updated_at: string
}

export interface TrendItemDetail extends TrendItem {
  raw_metadata: Record<string, unknown>
}

export interface TrendNiche {
  id: number
  workspace_id: number
  name: string
  keywords: string[]
  platforms: TrendPlatform[]
  is_active: boolean
  monitoring_interval_hours: number
  language: string
  region: string
  keyword_mode: TrendKeywordMode
  created_at: string
  updated_at: string
}

export interface TrendAlert {
  id: number
  workspace_id: number
  niche_id: number | null
  trend_item_id: number | null
  alert_type: TrendAlertType
  title: string
  body: string | null
  is_read: boolean
  read_at: string | null
  threshold_triggered: Record<string, unknown> | null
  created_at: string
}

export interface TrendSnapshot {
  id: number
  trend_item_id: number
  recorded_at: string
  views_count: number | null
  likes_count: number | null
  comments_count: number | null
  velocity: number | null
  viral_score: number | null
}

export interface TrendNicheCreate {
  name: string
  keywords: string[]
  platforms: TrendPlatform[]
  monitoring_interval_hours?: number
  language?: string
  region?: string
  keyword_mode?: TrendKeywordMode
}

export interface TrendNicheUpdate {
  name?: string | null
  keywords?: string[] | null
  platforms?: TrendPlatform[] | null
  is_active?: boolean | null
  monitoring_interval_hours?: number | null
  language?: string | null
  region?: string | null
  keyword_mode?: TrendKeywordMode | null
}

export interface TrendFilters {
  platform?: TrendPlatform | null
  niche_id?: number | null
  stage?: TrendStage | null
  orientation?: TrendOrientation | null
  min_viral_score?: number | null
  sort_by?: string | null
  page?: number
  size?: number
}

export interface IntegrationStatus {
  configured: boolean
}

export interface IntegrationsStatusResponse {
  youtube: IntegrationStatus
  instagram: IntegrationStatus
}

export interface TrendAlertFilters {
  unread_only?: boolean
  page?: number
  size?: number
}

export interface TaskAccepted {
  status: string
  message: string
}

export interface TrendAlertSettings {
  is_enabled: boolean
  min_viral_score: number
  min_growth_rate: number
  niche_ids: number[]
  notify_new_trend: boolean
  notify_viral_trend: boolean
  notify_niche_spike: boolean
}

export interface TrendAlertSettingsUpdate {
  is_enabled?: boolean
  min_viral_score?: number
  min_growth_rate?: number
  niche_ids?: number[]
  notify_new_trend?: boolean
  notify_viral_trend?: boolean
  notify_niche_spike?: boolean
}

export type { PaginatedResponse }
