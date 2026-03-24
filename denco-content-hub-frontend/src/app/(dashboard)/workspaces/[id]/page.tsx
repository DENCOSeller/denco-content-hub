'use client'

import { Stack, Title, SimpleGrid, Text } from '@mantine/core'
import {
  IconSearch,
  IconSettings,
  IconShare,
  IconFileText,
  IconSend,
  IconTrendingUp,
  IconUsers,
  IconCalendarEvent,
  IconTopologyStarRing3,
} from '@tabler/icons-react'
import { useParams } from 'next/navigation'

import { useWorkspaceStore } from '@/stores/workspace-store'
import { AppBreadcrumbs } from '@/components/shared/Breadcrumbs'
import { SectionCard } from '@/components/features/workspace/SectionCard'
import { KpiCard, KpiCardSkeleton } from '@/components/features/workspace/KpiCard'
import { useSetAiPageContext } from '@/stores/ai-page-store'
import { useContentListQuery } from '@/api/hooks/useContent'
import { useTrendsQuery } from '@/api/hooks/useTrends'
import { useCompetitorsQuery } from '@/api/hooks/useCompetitors'
import { useContentPlanItemsQuery } from '@/api/hooks/useContentPlan'
import { useWorkspaceGraphQuery } from '@/api/hooks/useKnowledge'

export default function WorkspaceHubPage() {
  const params = useParams()
  const workspaceId = params.id as string
  const wsId = Number(workspaceId)
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)

  useSetAiPageContext({
    page_type: 'workspace',
    workspace_id: wsId,
    workspace_name: activeWorkspace?.name,
  })

  // KPI data queries
  const contentQuery = useContentListQuery({ workspaceId: wsId, page: 1, size: 1 })
  const trendsQuery = useTrendsQuery(wsId, { page: 1, size: 1 })
  const competitorsQuery = useCompetitorsQuery(wsId, 1, 1)
  const planQuery = useContentPlanItemsQuery(wsId, { page: 1, size: 1 })
  const graphQuery = useWorkspaceGraphQuery(wsId)

  // Published content = content with status 'completed'
  const publishedQuery = useContentListQuery({
    workspaceId: wsId,
    page: 1,
    size: 1,
    status: 'completed',
  })

  const isLoading =
    contentQuery.isLoading ||
    trendsQuery.isLoading ||
    competitorsQuery.isLoading ||
    planQuery.isLoading ||
    graphQuery.isLoading ||
    publishedQuery.isLoading

  const breadcrumbs = [
    { label: activeWorkspace?.company_name ?? '' },
    { label: activeWorkspace?.name ?? '' },
  ]

  return (
    <Stack>
      <AppBreadcrumbs items={breadcrumbs} />
      <Title order={2}>{activeWorkspace?.name}</Title>

      <Text size="sm" c="dimmed">
        Обзор воркспейса
      </Text>

      {/* KPI Cards */}
      <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="md">
        {isLoading ? (
          <>
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
          </>
        ) : (
          <>
            <KpiCard
              icon={IconFileText}
              value={contentQuery.data?.total ?? 0}
              label="Контент"
            />
            <KpiCard
              icon={IconSend}
              value={publishedQuery.data?.total ?? 0}
              label="Публикации"
            />
            <KpiCard
              icon={IconTrendingUp}
              value={trendsQuery.data?.total ?? 0}
              label="Тренды"
            />
            <KpiCard
              icon={IconUsers}
              value={competitorsQuery.data?.total ?? 0}
              label="Конкуренты"
            />
            <KpiCard
              icon={IconCalendarEvent}
              value={planQuery.data?.total ?? 0}
              label="Элементы плана"
            />
            <KpiCard
              icon={IconTopologyStarRing3}
              value={graphQuery.data?.nodes?.length ?? 0}
              label="Узлы графа"
            />
          </>
        )}
      </SimpleGrid>

      {/* Quick Links */}
      <Title order={4} mt="md">
        Быстрый доступ
      </Title>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <SectionCard
          title="Референсы"
          description="Контент воркспейса"
          icon={IconSearch}
          href={`/workspaces/${workspaceId}/references`}
        />
        <SectionCard
          title="Граф знаний"
          description="Визуальная карта знаний"
          icon={IconShare}
          href={`/workspaces/${workspaceId}/knowledge`}
        />
        <SectionCard
          title="Настройки"
          description="Управление воркспейсом"
          icon={IconSettings}
          href={`/workspaces/${workspaceId}/settings`}
        />
      </SimpleGrid>
    </Stack>
  )
}
