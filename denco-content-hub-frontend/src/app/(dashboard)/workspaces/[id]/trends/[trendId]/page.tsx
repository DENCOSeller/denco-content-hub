'use client'

import {
  Alert,
  Button,
  Card,
  Group,
  ScrollArea,
  Skeleton,
  Stack,
  Title,
} from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useParams } from 'next/navigation'

import { PageHeader } from '@/components/shared/PageHeader'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { AppBreadcrumbs } from '@/components/shared/Breadcrumbs'
import {
  useTrendDetailQuery,
  useTrendSnapshotsQuery,
  useGenerateTrendIntelligenceMutation,
  useTrendNicheDetailQuery,
  useTrendsQuery,
} from '@/api/hooks/useTrends'

import { TrendEmbedPreview } from '@/components/features/trends/TrendEmbedPreview'
import { TrendHeader } from '@/components/features/trends/TrendHeader'
import { TrendIntelligenceSection } from '@/components/features/trends/TrendIntelligenceSection'
import { TrendGrowthChart } from '@/components/features/trends/TrendGrowthChart'
import { TrendMetricsPanel } from '@/components/features/trends/TrendMetricsPanel'
import { TrendCard } from '@/components/features/trends/TrendCard'
import styles from '../trends.module.css'

export default function TrendDetailPage() {
  const params = useParams()
  const workspaceId = Number(params.id)
  const trendId = Number(params.trendId)
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)

  const {
    data: trend,
    isLoading,
    isError,
    refetch,
  } = useTrendDetailQuery(workspaceId, trendId)

  const snapshotsQuery = useTrendSnapshotsQuery(workspaceId, trendId)

  const nicheQuery = useTrendNicheDetailQuery(
    workspaceId,
    trend?.niche_id ?? 0,
  )

  const generateMutation = useGenerateTrendIntelligenceMutation(workspaceId)

  const breadcrumbs = [
    { label: activeWorkspace?.company_name ?? '' },
    { label: activeWorkspace?.name ?? '', href: `/workspaces/${workspaceId}` },
    { label: 'Тренды', href: `/workspaces/${workspaceId}/trends` },
    { label: trend?.title ?? 'Детали тренда' },
  ]

  if (isLoading) {
    return (
      <Stack gap="lg" className={styles.detailSkeleton}>
        <AppBreadcrumbs items={breadcrumbs} />
        <Skeleton height={20} width="40%" />
        <Skeleton height={32} width="60%" />
        <div className={styles.detailGrid}>
          <div className={styles.detailMainColumn}>
            <Skeleton height={400} radius="md" />
            <Skeleton height={120} radius="md" />
            <Skeleton height={300} radius="md" />
          </div>
          <div className={styles.detailSideColumn}>
            <Skeleton height={400} radius="md" />
          </div>
        </div>
      </Stack>
    )
  }

  if (isError || !trend) {
    return (
      <Stack gap="lg">
        <AppBreadcrumbs items={breadcrumbs} />
        <Alert icon={<IconAlertCircle />} color="red" title="Ошибка">
          <Stack gap="sm">
            Не удалось загрузить данные тренда
            <Button variant="light" color="red" size="xs" onClick={() => refetch()}>
              Повторить
            </Button>
          </Stack>
        </Alert>
      </Stack>
    )
  }

  return (
    <Stack gap="lg">
      <AppBreadcrumbs items={breadcrumbs} />

      <PageHeader
        title={trend.title ?? 'Без названия'}
        subtitle={trend.channel_name ?? undefined}
      />

      <div className={styles.detailGrid}>
        {/* Left column */}
        <div className={styles.detailMainColumn}>
          <TrendEmbedPreview trend={trend} />

          <TrendHeader
            trend={trend}
            onAnalyze={() => generateMutation.mutate({ trendItemId: trendId })}
            isAnalyzing={generateMutation.isPending}
          />

          <TrendGrowthChart
            snapshots={snapshotsQuery.data}
            isLoading={snapshotsQuery.isLoading}
          />

          <TrendIntelligenceSection
            workspaceId={workspaceId}
            trendItemId={trendId}
          />

          {trend.niche_id != null && (
            <SimilarTrends
              workspaceId={workspaceId}
              nicheId={trend.niche_id}
              excludeTrendId={trendId}
            />
          )}
        </div>

        {/* Right column */}
        <div className={styles.detailSideColumn}>
          <TrendMetricsPanel
            trend={trend}
            niche={trend.niche_id ? nicheQuery.data : undefined}
          />
        </div>
      </div>
    </Stack>
  )
}

/* ─── Similar Trends (conditional query) ─────────────────────────── */

function SimilarTrends({
  workspaceId,
  nicheId,
  excludeTrendId,
}: {
  workspaceId: number
  nicheId: number
  excludeTrendId: number
}) {
  const { data } = useTrendsQuery(workspaceId, {
    niche_id: nicheId,
    size: 10,
  })

  const similarTrends = data?.items?.filter((t) => t.id !== excludeTrendId) ?? []

  if (!similarTrends.length) return null

  return (
    <Card padding="lg" radius="md" className={styles.similarTrendsCard}>
      <Stack gap="md">
        <Title order={5} c="gray.1">Похожие тренды</Title>
        <ScrollArea type="auto" offsetScrollbars>
          <Group gap="md" wrap="nowrap">
            {similarTrends.slice(0, 6).map((t) => (
              <div key={t.id} className={styles.similarTrendItem}>
                <TrendCard item={t} workspaceId={workspaceId} />
              </div>
            ))}
          </Group>
        </ScrollArea>
      </Stack>
    </Card>
  )
}
