'use client'

import {
  Card,
  Group,
  Stack,
  Text,
  Badge,
  Box,
} from '@mantine/core'
import Link from 'next/link'
import {
  IconBrandYoutube,
  IconBrandInstagram,
  IconTrendingUp,
  IconFlame,
  IconPhoto,
} from '@tabler/icons-react'

import type { TrendItem, TrendStage, TrendPlatform, TrendOrientation } from '@/api/types/trend'

import styles from './TrendCard.module.css'

interface TrendCardProps {
  item: TrendItem
  workspaceId: number
}

const PLATFORM_CONFIG: Record<TrendPlatform, { icon: typeof IconBrandYoutube; color: string; bg: string; label: string }> = {
  youtube: { icon: IconBrandYoutube, color: '#fff', bg: '#FF0000', label: 'YouTube' },
  instagram: { icon: IconBrandInstagram, color: '#fff', bg: '#E1306C', label: 'Instagram' },
}

const STAGE_CONFIG: Record<TrendStage, { label: string; color: string }> = {
  rising: { label: 'Растёт', color: 'green' },
  peaking: { label: 'Пик', color: 'orange' },
  declining: { label: 'Спад', color: 'gray' },
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

const ORIENTATION_CONFIG: Record<TrendOrientation, { label: string; color: string }> = {
  shorts: { label: 'Shorts', color: 'orange' },
  long_video: { label: 'Long', color: 'blue' },
  reels: { label: 'Reels', color: 'violet' },
}

function getViralClass(score: number | null): string {
  if (score == null) return styles.viralLow
  if (score >= 70) return styles.viralHigh
  if (score >= 40) return styles.viralMedium
  return styles.viralLow
}

export function TrendCard({ item, workspaceId }: TrendCardProps) {
  const platform = PLATFORM_CONFIG[item.platform]
  const PlatformIcon = platform.icon
  const stage = item.stage ? STAGE_CONFIG[item.stage] : null
  const orientation = item.orientation ? ORIENTATION_CONFIG[item.orientation] : null

  return (
    <Card
      component={Link}
      href={`/workspaces/${workspaceId}/trends/${item.id}`}
      padding={0}
      radius="md"
      className={styles.card}
    >
      <Box pos="relative">
        {item.thumbnail_url ? (
          <img
            src={item.thumbnail_url}
            alt={item.title ?? ''}
            className={styles.thumbnail}
          />
        ) : (
          <div className={styles.thumbnailPlaceholder}>
            <IconPhoto size={32} style={{ color: 'var(--mantine-color-dimmed)' }} />
          </div>
        )}

        <Badge
          className={styles.platformBadge}
          size="sm"
          leftSection={<PlatformIcon size={12} />}
          style={{ background: platform.bg, color: platform.color }}
        >
          {platform.label}
        </Badge>

        {orientation && (
          <Badge
            className={styles.orientationBadge}
            size="xs"
            variant="light"
            color={orientation.color}
          >
            {orientation.label}
          </Badge>
        )}

        {stage && (
          <Badge
            className={styles.stageBadge}
            size="sm"
            variant="light"
            color={stage.color}
          >
            {stage.label}
          </Badge>
        )}
      </Box>

      <Stack gap={4} p="sm">
        <Text fw={500} c="gray.1" lineClamp={2} size="sm">
          {item.title ?? 'Без названия'}
        </Text>

        {item.channel_name && (
          <Text size="xs" c="dimmed" truncate="end">
            {item.channel_name}
          </Text>
        )}

        <Group gap="xs" mt={4}>
          <Text size="xs" c="dimmed">
            {formatViews(item.views_count)} просм.
          </Text>

          {item.velocity != null && (
            <Group gap={2}>
              <IconTrendingUp size={12} style={{ color: 'var(--mantine-color-blue-5)' }} />
              <Text size="xs" c="blue.5">
                {item.velocity.toFixed(1)}%
              </Text>
            </Group>
          )}

          {item.er_score != null && (
            <Text size="xs" c="dimmed">
              ER {item.er_score.toFixed(1)}%
            </Text>
          )}

          {item.viral_score != null && (
            <Group gap={2}>
              <IconFlame size={12} className={getViralClass(item.viral_score)} />
              <Text size="xs" fw={600} className={getViralClass(item.viral_score)}>
                {item.viral_score.toFixed(0)}
              </Text>
            </Group>
          )}
        </Group>
      </Stack>
    </Card>
  )
}
