// Расширенные типы контента с YouTube метриками
// Бэкенд возвращает эти поля, но автогенерация типов ещё не обновлена

import type { ContentItemResponse, ContentItemShortResponse } from '@/api/client/types.gen'

export interface YouTubeMetrics {
  views_count?: number | null
  likes_count?: number | null
  comments_count?: number | null
  published_at?: string | null
  channel_title?: string | null
  thumbnail_url?: string | null
}

export type ContentItemWithYouTube = ContentItemResponse & YouTubeMetrics

export type ContentItemShortWithYouTube = ContentItemShortResponse & YouTubeMetrics
