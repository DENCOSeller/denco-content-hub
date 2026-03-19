'use client'

import { Card, Skeleton, Stack, Text, Title } from '@mantine/core'
import { AreaChart } from '@mantine/charts'
import dayjs from 'dayjs'

import type { TrendSnapshot } from '@/api/types/trend'

interface TrendGrowthChartProps {
  snapshots: TrendSnapshot[] | undefined
  isLoading: boolean
}

function formatDate(dateStr: string): string {
  return dayjs(dateStr).format('DD.MM HH:mm')
}

export function TrendGrowthChart({ snapshots, isLoading }: TrendGrowthChartProps) {
  if (isLoading) {
    return (
      <Card padding="lg" radius="md" bg="dark.6">
        <Stack gap="md">
          <Skeleton height={20} width="30%" />
          <Skeleton height={200} />
        </Stack>
      </Card>
    )
  }

  if (!snapshots?.length) {
    return (
      <Card padding="lg" radius="md" bg="dark.6">
        <Stack gap="md" align="center" py="xl">
          <Text c="dimmed" size="sm">Нет данных о динамике</Text>
        </Stack>
      </Card>
    )
  }

  const chartData = snapshots.map((s) => ({
    date: formatDate(s.recorded_at),
    'Просмотры': s.views_count ?? 0,
    'Viral Score': s.viral_score ?? 0,
  }))

  return (
    <Card padding="lg" radius="md" bg="dark.6">
      <Stack gap="md">
        <Title order={5} c="gray.1">Динамика роста</Title>
        <AreaChart
          h={250}
          data={chartData}
          dataKey="date"
          series={[
            { name: 'Просмотры', color: 'blue.6' },
            { name: 'Viral Score', color: 'red.6' },
          ]}
          curveType="monotone"
          withLegend
          withDots={false}
          gridAxis="xy"
          yAxisProps={{ width: 60 }}
        />
      </Stack>
    </Card>
  )
}
