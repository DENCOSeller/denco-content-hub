'use client'

import { Badge, Button, Group, Stack, Text, Title } from '@mantine/core'
import {
  IconBrandInstagram,
  IconBrandYoutube,
  IconExternalLink,
  IconSparkles,
} from '@tabler/icons-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/ru'

import type { TrendPlatform } from '@/api/types/trend'

dayjs.extend(relativeTime)
dayjs.locale('ru')

const PLATFORM_CONFIG: Record<TrendPlatform, { icon: typeof IconBrandYoutube; color: string; bg: string; label: string }> = {
  youtube: { icon: IconBrandYoutube, color: '#fff', bg: '#FF0000', label: 'YouTube' },
  instagram: { icon: IconBrandInstagram, color: '#fff', bg: '#E1306C', label: 'Instagram' },
}

interface TrendHeaderProps {
  trend: {
    title: string | null
    channel_name: string | null
    channel_url: string | null
    published_at: string | null
    platform: TrendPlatform
    post_url: string | null
  }
  onAnalyze: () => void
  isAnalyzing: boolean
}

export function TrendHeader({ trend, onAnalyze, isAnalyzing }: TrendHeaderProps) {
  const platform = PLATFORM_CONFIG[trend.platform]
  const PlatformIcon = platform.icon

  return (
    <Stack gap="sm">
      <Group gap="sm" align="center">
        <Badge
          size="sm"
          leftSection={<PlatformIcon size={12} />}
          style={{ background: platform.bg, color: platform.color }}
        >
          {platform.label}
        </Badge>
        {trend.published_at && (
          <Text size="xs" c="dimmed">
            {dayjs(trend.published_at).fromNow()}
          </Text>
        )}
      </Group>

      <Title order={3} c="gray.1">
        {trend.title ?? 'Без названия'}
      </Title>

      {trend.channel_name && (
        <Text
          size="sm"
          c="dimmed"
          component={trend.channel_url ? 'a' : 'span'}
          href={trend.channel_url ?? undefined}
          target="_blank"
          td={trend.channel_url ? 'underline' : undefined}
        >
          {trend.channel_name}
        </Text>
      )}

      <Group gap="sm">
        {trend.post_url && (
          <Button
            variant="light"
            size="sm"
            leftSection={<IconExternalLink size={16} />}
            onClick={() => window.open(trend.post_url!, '_blank')}
          >
            Открыть оригинал
          </Button>
        )}
        <Button
          variant="filled"
          color="violet"
          size="sm"
          leftSection={<IconSparkles size={16} />}
          loading={isAnalyzing}
          onClick={onAnalyze}
        >
          Анализ с AI
        </Button>
      </Group>
    </Stack>
  )
}
