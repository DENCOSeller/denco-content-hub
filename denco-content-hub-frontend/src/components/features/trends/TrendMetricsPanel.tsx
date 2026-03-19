'use client'

import {
  Badge,
  Card,
  Group,
  RingProgress,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { DonutChart } from '@mantine/charts'
import {
  IconEye,
  IconThumbUp,
  IconMessage,
  IconShare,
  IconTrendingUp,
  IconBolt,
  IconActivity,
} from '@tabler/icons-react'
import dayjs from 'dayjs'

import type { TrendItemDetail, TrendStage, TrendNiche } from '@/api/types/trend'

interface TrendMetricsPanelProps {
  trend: TrendItemDetail
  niche: TrendNiche | undefined
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

function getViralColor(score: number | null): string {
  if (score == null) return 'blue'
  if (score >= 70) return 'red'
  if (score >= 40) return 'orange'
  return 'blue'
}

export function TrendMetricsPanel({ trend, niche }: TrendMetricsPanelProps) {
  const viralScore = trend.viral_score ?? 0
  const viralColor = getViralColor(trend.viral_score)

  const engagementData = [
    { name: 'Лайки', value: trend.likes_count, color: 'pink.6' },
    { name: 'Комментарии', value: trend.comments_count, color: 'blue.6' },
    { name: 'Репосты', value: trend.shares_count, color: 'green.6' },
  ].filter((d) => d.value > 0)

  return (
    <Stack gap="md">
      {/* Viral Score */}
      <Card padding="lg" radius="md" bg="dark.6">
        <Stack align="center" gap="xs">
          <RingProgress
            size={120}
            thickness={10}
            roundCaps
            sections={[{ value: viralScore, color: viralColor }]}
            label={
              <Stack align="center" gap={0}>
                <Text fw={700} size="xl" ta="center" c="gray.1">
                  {viralScore.toFixed(0)}
                </Text>
                <Text size="xs" c="dimmed" ta="center">
                  Viral Score
                </Text>
              </Stack>
            }
          />
        </Stack>
      </Card>

      {/* Stage */}
      {trend.stage && (
        <Card padding="md" radius="md" bg="dark.6">
          <Stack align="center" gap="xs">
            <Text size="xs" c="dimmed">Стадия</Text>
            <Badge
              size="lg"
              variant="light"
              color={STAGE_CONFIG[trend.stage].color}
            >
              {STAGE_CONFIG[trend.stage].label}
            </Badge>
          </Stack>
        </Card>
      )}

      {/* Metrics */}
      <Card padding="md" radius="md" bg="dark.6">
        <Stack gap="sm">
          <Title order={6} c="gray.2">Метрики</Title>
          <MetricRow icon={<IconEye size={16} />} label="Просмотры" value={formatViews(trend.views_count)} />
          <MetricRow icon={<IconThumbUp size={16} />} label="Лайки" value={formatViews(trend.likes_count)} />
          <MetricRow icon={<IconMessage size={16} />} label="Комментарии" value={formatViews(trend.comments_count)} />
          <MetricRow icon={<IconShare size={16} />} label="Репосты" value={formatViews(trend.shares_count)} />
          {trend.er_score != null && (
            <MetricRow icon={<IconActivity size={16} />} label="ER Score" value={`${trend.er_score.toFixed(1)}%`} />
          )}
          {trend.velocity != null && (
            <MetricRow icon={<IconTrendingUp size={16} />} label="Velocity" value={`${trend.velocity.toFixed(1)}%`} />
          )}
          {trend.acceleration != null && (
            <MetricRow icon={<IconBolt size={16} />} label="Acceleration" value={trend.acceleration.toFixed(2)} />
          )}
        </Stack>
      </Card>

      {/* Engagement Donut */}
      {engagementData.length > 0 && (
        <Card padding="md" radius="md" bg="dark.6">
          <Stack gap="sm">
            <Title order={6} c="gray.2">Вовлечённость</Title>
            <DonutChart
              data={engagementData}
              withLabelsLine
              withLabels
              size={160}
              thickness={20}
            />
          </Stack>
        </Card>
      )}

      {/* Niche */}
      {niche && (
        <Card padding="md" radius="md" bg="dark.6">
          <Stack gap="xs">
            <Title order={6} c="gray.2">Ниша</Title>
            <Text size="sm" c="gray.1">{niche.name}</Text>
            <Group gap={4} wrap="wrap">
              {niche.keywords.map((kw) => (
                <Badge key={kw} size="xs" variant="outline" color="gray">
                  {kw}
                </Badge>
              ))}
            </Group>
          </Stack>
        </Card>
      )}

      {/* Competitor match */}
      {trend.competitor_post_id != null && (
        <Card padding="md" radius="md" bg="dark.6">
          <Stack gap="xs">
            <Title order={6} c="gray.2">Конкурент</Title>
            <Text size="sm" c="yellow.5">
              Совпадение с конкурентом #{trend.competitor_post_id}
            </Text>
          </Stack>
        </Card>
      )}

      {/* Meta info */}
      <Card padding="md" radius="md" bg="dark.6">
        <Stack gap="xs">
          <Title order={6} c="gray.2">Информация</Title>
          <MetaRow label="Обнаружен" value={dayjs(trend.detected_at).format('DD.MM.YYYY HH:mm')} />
          {trend.published_at && (
            <MetaRow label="Опубликован" value={dayjs(trend.published_at).format('DD.MM.YYYY HH:mm')} />
          )}
          <MetaRow label="Platform ID" value={trend.platform_post_id} />
        </Stack>
      </Card>
    </Stack>
  )
}

function MetricRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Group justify="space-between">
      <Group gap="xs">
        {icon}
        <Text size="sm" c="dimmed">{label}</Text>
      </Group>
      <Text size="sm" fw={600} c="gray.1">{value}</Text>
    </Group>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between">
      <Text size="xs" c="dimmed">{label}</Text>
      <Text size="xs" c="gray.3">{value}</Text>
    </Group>
  )
}
