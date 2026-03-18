'use client'

import { Card, Group, Stack, Text, Badge } from '@mantine/core'
import { IconEye, IconThumbUp, IconMessageCircle } from '@tabler/icons-react'
import Image from 'next/image'

import type { CompetitorPost } from '@/api/types/competitor'
import { formatNumber } from '@/lib/utils/youtube'

interface PostCardProps {
  post: CompetitorPost
  isSelected: boolean
  onSelect: () => void
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 60) return `${diffMinutes} мин. назад`
  if (diffHours < 24) return `${diffHours} ч. назад`
  if (diffDays === 1) return 'Вчера'
  if (diffDays < 7) return `${diffDays} дн. назад`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} нед. назад`
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function truncateText(text?: string, maxLen = 200): string {
  if (!text) return ''
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen).trimEnd() + '…'
}

const analysisStatusLabels: Record<string, { label: string; color: string }> = {
  analyzed: { label: 'Проанализирован', color: 'green' },
  analyzing: { label: 'Анализируется', color: 'blue' },
  pending_analysis: { label: 'Ожидает анализа', color: 'yellow' },
  new: { label: 'Новый', color: 'gray' },
  skipped: { label: 'Пропущен', color: 'gray' },
  failed: { label: 'Ошибка', color: 'red' },
}

export function PostCard({ post, isSelected, onSelect }: PostCardProps) {
  const previewText = post.title || post.description
  const statusCfg = analysisStatusLabels[post.analysis_status] ?? { label: post.analysis_status, color: 'gray' }

  return (
    <Card
      withBorder
      padding="md"
      radius="md"
      onClick={onSelect}
      style={{
        cursor: 'pointer',
        borderColor: isSelected ? 'var(--neon-blue)' : undefined,
      }}
    >
      <Group gap="md" wrap="nowrap" align="flex-start">
        {post.thumbnail_url && (
          <Image
            src={post.thumbnail_url}
            alt={post.title ?? 'Превью'}
            width={160}
            height={90}
            style={{ borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
          />
        )}

        <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
          {previewText && (
            <Text size="sm" lineClamp={2}>
              {truncateText(previewText)}
            </Text>
          )}

          <Group justify="space-between" wrap="wrap">
            <Group gap="md">
              <Group gap={4}>
                <IconEye size={14} color="var(--mantine-color-dimmed)" />
                <Text size="xs" c="dimmed">{formatNumber(post.views_count)}</Text>
              </Group>
              <Group gap={4}>
                <IconThumbUp size={14} color="var(--mantine-color-dimmed)" />
                <Text size="xs" c="dimmed">{formatNumber(post.likes_count)}</Text>
              </Group>
              <Group gap={4}>
                <IconMessageCircle size={14} color="var(--mantine-color-dimmed)" />
                <Text size="xs" c="dimmed">{formatNumber(post.comments_count)}</Text>
              </Group>
            </Group>

            <Group gap="sm">
              <Badge size="xs" variant="light" color={statusCfg.color}>
                {statusCfg.label}
              </Badge>
              <Text size="xs" c="dimmed">
                {formatRelativeDate(post.published_at)}
              </Text>
            </Group>
          </Group>
        </Stack>
      </Group>
    </Card>
  )
}
