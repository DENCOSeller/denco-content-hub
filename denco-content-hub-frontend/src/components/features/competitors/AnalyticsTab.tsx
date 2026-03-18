'use client'

import { useMemo } from 'react'
import { Stack, Paper, Text, Group, SimpleGrid } from '@mantine/core'
import { useMantineTheme } from '@mantine/core'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { IconEye, IconUsers, IconFileText } from '@tabler/icons-react'

import { useChannelSnapshotsQuery } from '@/api/hooks/useCompetitors'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { EmptyState } from '@/components/shared/EmptyState'
import type { CompetitorChannelSnapshot } from '@/api/types/competitor'

interface AnalyticsTabProps {
  channelId: number
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(value)
}

interface ChartCardProps {
  title: string
  icon: typeof IconEye
  color: string
  data: Array<{ date: string; value: number }>
  strokeColor: string
  fillColor: string
}

function ChartCard({ title, icon: Icon, color, data, strokeColor, fillColor }: ChartCardProps) {
  return (
    <Paper withBorder p="md" radius="md">
      <Group gap="xs" mb="md">
        <Icon size={18} color={color} />
        <Text fw={600} size="sm">{title}</Text>
      </Group>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--mantine-color-dark-4)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'var(--mantine-color-dimmed)' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={formatNumber}
            tick={{ fontSize: 11, fill: 'var(--mantine-color-dimmed)' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--mantine-color-dark-7)',
              border: '1px solid var(--mantine-color-dark-4)',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: 'var(--mantine-color-dimmed)' }}
            formatter={(val) => [Number(val).toLocaleString('ru-RU'), title]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={strokeColor}
            fill={fillColor}
            strokeWidth={2}
            fillOpacity={0.15}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Paper>
  )
}

function prepareChartData(
  snapshots: CompetitorChannelSnapshot[],
  field: keyof CompetitorChannelSnapshot,
) {
  return snapshots.map((s) => ({
    date: formatDate(s.recorded_at),
    value: Number(s[field]) || 0,
  }))
}

export function AnalyticsTab({ channelId }: AnalyticsTabProps) {
  const { data: snapshots, isLoading, isError, refetch } = useChannelSnapshotsQuery(channelId)
  const theme = useMantineTheme()

  const viewsData = useMemo(
    () => (snapshots ? prepareChartData(snapshots, 'total_views_30d') : []),
    [snapshots],
  )
  const subscribersData = useMemo(
    () => (snapshots ? prepareChartData(snapshots, 'subscribers_count') : []),
    [snapshots],
  )
  const postsData = useMemo(
    () => (snapshots ? prepareChartData(snapshots, 'posts_count_30d') : []),
    [snapshots],
  )

  if (isLoading) return <LoadingState message="Загрузка аналитики..." />
  if (isError) return <ErrorState onRetry={refetch} />
  if (!snapshots?.length) return <EmptyState message="Нет данных аналитики. Данные появятся после синхронизации." />

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="md">
        <ChartCard
          title="Просмотры за 30 дней"
          icon={IconEye}
          color={theme.colors.blue[5]}
          data={viewsData}
          strokeColor={theme.colors.blue[5]}
          fillColor={theme.colors.blue[5]}
        />
        <ChartCard
          title="Подписчики"
          icon={IconUsers}
          color={theme.colors.teal[5]}
          data={subscribersData}
          strokeColor={theme.colors.teal[5]}
          fillColor={theme.colors.teal[5]}
        />
        <ChartCard
          title="Публикации за 30 дней"
          icon={IconFileText}
          color={theme.colors.violet[5]}
          data={postsData}
          strokeColor={theme.colors.violet[5]}
          fillColor={theme.colors.violet[5]}
        />
      </SimpleGrid>
    </Stack>
  )
}
