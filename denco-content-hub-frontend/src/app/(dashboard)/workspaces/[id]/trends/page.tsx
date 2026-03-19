'use client'

import { useMemo } from 'react'
import {
  Title,
  Stack,
  Group,
  Button,
  Text,
  Tabs,
  SimpleGrid,
  Pagination,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconRadar, IconFlame } from '@tabler/icons-react'
import { useParams, useSearchParams, useRouter, usePathname } from 'next/navigation'

import { useTrendsQuery, useTrendNichesQuery, useDiscoverNowMutation } from '@/api/hooks/useTrends'
import type { TrendPlatform, TrendStage, TrendItem } from '@/api/types/trend'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { EmptyState } from '@/components/shared/EmptyState'
import { AppBreadcrumbs } from '@/components/shared/Breadcrumbs'
import { TrendCard } from '@/components/features/trends/TrendCard'
import { TrendFilters } from '@/components/features/trends/TrendFilters'
import { TrendStatsStrip } from '@/components/features/trends/TrendStatsStrip'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { pluralize } from '@/utils/pluralize'

import styles from './trends.module.css'

type TabValue = 'all' | 'my_niches' | 'youtube' | 'instagram'

export default function TrendsPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const workspaceId = Number(params.id)
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)

  const tab = (searchParams.get('tab') as TabValue) || 'all'
  const page = Number(searchParams.get('page')) || 1
  const nicheId = searchParams.get('niche_id') ? Number(searchParams.get('niche_id')) : null
  const stage = (searchParams.get('stage') as TrendStage) || null
  const minViralScore = searchParams.get('min_viral_score')
    ? Number(searchParams.get('min_viral_score'))
    : null
  const sortBy = searchParams.get('sort_by') || null

  const updateSearchParams = (updates: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '') {
        newParams.delete(key)
      } else {
        newParams.set(key, value)
      }
    }
    router.push(`${pathname}?${newParams.toString()}`)
  }

  const effectivePlatform = useMemo((): TrendPlatform | null => {
    if (tab === 'youtube') return 'youtube'
    if (tab === 'instagram') return 'instagram'
    return null
  }, [tab])

  const { data: nichesData } = useTrendNichesQuery(workspaceId, 1, 100, true)
  const activeNiches = nichesData?.items ?? []

  const {
    data: trendsData,
    isLoading,
    isError,
    refetch,
  } = useTrendsQuery(workspaceId, {
    page,
    size: 18,
    platform: effectivePlatform,
    niche_id: tab === 'my_niches' ? undefined : (nicheId ?? undefined),
    stage: stage ?? undefined,
    min_viral_score: minViralScore ?? undefined,
    sort_by: sortBy ?? undefined,
  })

  const discoverNow = useDiscoverNowMutation(workspaceId)

  const handleDiscoverNow = () => {
    discoverNow.mutate(undefined, {
      onSuccess: () => {
        notifications.show({
          title: 'Запущено',
          message: 'Обнаружение трендов запущено. Результаты появятся в течение нескольких минут.',
          color: 'green',
        })
      },
      onError: () => {
        notifications.show({
          title: 'Ошибка',
          message: 'Не удалось запустить обнаружение трендов',
          color: 'red',
        })
      },
    })
  }

  const handleTabChange = (value: string | null) => {
    updateSearchParams({ tab: value === 'all' ? null : value, page: null })
  }

  const handlePageChange = (newPage: number) => {
    updateSearchParams({ page: String(newPage) })
  }

  const breadcrumbs = [
    { label: activeWorkspace?.company_name ?? '', href: '/dashboard' },
    { label: activeWorkspace?.name ?? '', href: `/workspaces/${workspaceId}` },
    { label: 'Тренды' },
  ]

  const userNicheIds = useMemo(
    () => new Set(activeNiches.map((n) => n.id)),
    [activeNiches],
  )

  const allItems = trendsData?.items ?? []
  const items: TrendItem[] = useMemo(() => {
    if (tab !== 'my_niches') return allItems
    return allItems.filter((item) => item.niche_id != null && userNicheIds.has(item.niche_id))
  }, [tab, allItems, userNicheIds])

  return (
    <Stack gap="lg">
      <AppBreadcrumbs items={breadcrumbs} />

      <Group justify="space-between" align="center">
        <Title order={2} className={styles.pageTitle}>
          Тренды
        </Title>
        <Button
          leftSection={<IconRadar size={16} />}
          onClick={handleDiscoverNow}
          loading={discoverNow.isPending}
        >
          Обнаружить сейчас
        </Button>
      </Group>

      <Tabs value={tab} onChange={handleTabChange}>
        <Tabs.List>
          <Tabs.Tab value="all">Все</Tabs.Tab>
          <Tabs.Tab value="my_niches">Мои ниши</Tabs.Tab>
          <Tabs.Tab value="youtube">YouTube</Tabs.Tab>
          <Tabs.Tab value="instagram">Instagram</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {items.length > 0 && <TrendStatsStrip items={items} total={trendsData?.total ?? items.length} />}

      <TrendFilters
        nicheId={nicheId}
        stage={stage}
        minViralScore={minViralScore}
        sortBy={sortBy}
        niches={activeNiches}
        onNicheChange={(v) =>
          updateSearchParams({ niche_id: v != null ? String(v) : null, page: null })
        }
        onStageChange={(v) => updateSearchParams({ stage: v, page: null })}
        onMinViralScoreChange={(v) =>
          updateSearchParams({ min_viral_score: v != null ? String(v) : null, page: null })
        }
        onSortByChange={(v) => updateSearchParams({ sort_by: v, page: null })}
      />

      {isLoading && <LoadingState />}
      {isError && <ErrorState onRetry={refetch} />}
      {!isLoading && !isError && items.length === 0 && (
        <EmptyState message="Нет трендов. Нажмите «Обнаружить сейчас» для поиска." />
      )}

      {items.length > 0 && (
        <Stack gap="sm">
          <Text className={styles.sectionTitle} px="sm">
            <Group gap={4} component="span">
              <IconFlame size={12} />
              {trendsData?.total ?? 0}{' '}
              {pluralize(trendsData?.total ?? 0, 'тренд', 'тренда', 'трендов')}
            </Group>
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {items.map((item) => (
              <TrendCard key={item.id} item={item} workspaceId={workspaceId} />
            ))}
          </SimpleGrid>
        </Stack>
      )}

      {trendsData && trendsData.pages > 1 && (
        <Group justify="center">
          <Pagination
            total={trendsData.pages}
            value={page}
            onChange={handlePageChange}
          />
        </Group>
      )}
    </Stack>
  )
}
