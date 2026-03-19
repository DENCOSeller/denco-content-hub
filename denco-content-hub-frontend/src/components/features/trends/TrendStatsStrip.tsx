'use client'

import { Group, Paper, Stack, Text } from '@mantine/core'
import {
  IconFlame,
  IconSparkles,
  IconTrendingUp,
  IconChartBar,
} from '@tabler/icons-react'

import type { TrendItem } from '@/api/types/trend'

interface TrendStatsStripProps {
  items: TrendItem[]
  total: number
}

function isToday(dateStr: string): boolean {
  const date = new Date(dateStr)
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

export function TrendStatsStrip({ items, total }: TrendStatsStripProps) {
  const pageCount = items.length
  const newToday = items.filter((i) => isToday(i.detected_at)).length
  const viral = items.filter((i) => (i.viral_score ?? 0) >= 70).length
  const avgViral =
    pageCount > 0
      ? items.reduce((sum, i) => sum + (i.viral_score ?? 0), 0) / pageCount
      : 0

  const stats = [
    { label: 'Всего трендов', value: total, icon: IconChartBar, color: 'blue' },
    { label: 'Новых сегодня', value: newToday, icon: IconSparkles, color: 'green' },
    { label: 'Viral', value: viral, icon: IconFlame, color: 'orange' },
    { label: 'Средний viral', value: avgViral.toFixed(1), icon: IconTrendingUp, color: 'violet' },
  ]

  return (
    <Group gap="sm" grow>
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <Paper key={stat.label} p="md" radius="md" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>
            <Group gap="sm">
              <Icon size={20} style={{ color: `var(--mantine-color-${stat.color}-5)` }} />
              <Stack gap={0}>
                <Text size="xs" c="dimmed">{stat.label}</Text>
                <Text fw={700} size="lg">{stat.value}</Text>
              </Stack>
            </Group>
          </Paper>
        )
      })}
    </Group>
  )
}
