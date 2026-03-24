'use client'

import { useMemo, useState } from 'react'
import {
  Stack,
  Button,
  Text,
  Tabs,
  SimpleGrid,
  Pagination,
  Group,
  Skeleton,
  Paper,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
  IconRadar,
  IconFlame,
  IconCategory,
  IconBell,
  IconPlus,
  IconActivity,
  IconTrendingUp,
  IconSettings,
} from '@tabler/icons-react'
import { useParams, useSearchParams, useRouter, usePathname } from 'next/navigation'

import { PageHeader } from '@/components/shared/PageHeader'
import {
  useTrendsQuery,
  useTrendNichesQuery,
  useDiscoverNowMutation,
  useTrendAlertsQuery,
} from '@/api/hooks/useTrends'
import type { TrendPlatform, TrendStage, TrendOrientation, TrendItem, TrendNiche } from '@/api/types/trend'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { AppBreadcrumbs } from '@/components/shared/Breadcrumbs'
import { TrendCard } from '@/components/features/trends/TrendCard'
import { TrendFilters } from '@/components/features/trends/TrendFilters'
import { TrendStatsStrip } from '@/components/features/trends/TrendStatsStrip'
import { NicheCard } from '@/components/features/trends/NicheCard'
import { NicheFormModal } from '@/components/features/trends/NicheFormModal'
import { AlertHistory } from '@/components/features/trends/AlertHistory'
import { AlertSettings } from '@/components/features/trends/AlertSettings'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { pluralize } from '@/utils/pluralize'

import styles from './trends.module.css'

type MainTab = 'feed' | 'niches' | 'alerts'
type FeedSubTab = 'all' | 'my_niches' | 'youtube' | 'instagram'
type AlertSubTab = 'history' | 'settings'

/* ─── Skeleton Components ────────────────────────────────────────── */

function FeedSkeleton() {
  return (
    <Stack gap="md">
      <Group gap="sm">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} height={28} width={80} radius="sm" />
        ))}
      </Group>
      <Group gap="sm">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} height={36} width={120} radius="sm" />
        ))}
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} height={260} radius="md" />
        ))}
      </SimpleGrid>
    </Stack>
  )
}

function NichesSkeleton() {
  return (
    <Stack gap="md">
      <Group gap="sm" grow>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} height={72} radius="md" />
        ))}
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} height={180} radius="md" />
        ))}
      </SimpleGrid>
    </Stack>
  )
}

function AlertsSkeleton() {
  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Skeleton height={28} width={180} radius="sm" />
        <Skeleton height={28} width={200} radius="sm" />
      </Group>
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} height={56} radius="sm" />
      ))}
    </Stack>
  )
}

/* ─── Feed Tab Content ───────────────────────────────────────────── */

function FeedTabContent({ workspaceId }: { workspaceId: number }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const feedTab = (searchParams.get('feedTab') as FeedSubTab) || 'all'
  const page = Number(searchParams.get('page')) || 1
  const nicheId = searchParams.get('niche_id') ? Number(searchParams.get('niche_id')) : null
  const stage = (searchParams.get('stage') as TrendStage) || null
  const minViralScore = searchParams.get('min_viral_score')
    ? Number(searchParams.get('min_viral_score'))
    : null
  const orientation = (searchParams.get('orientation') as TrendOrientation) || null
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
    if (feedTab === 'youtube') return 'youtube'
    if (feedTab === 'instagram') return 'instagram'
    return null
  }, [feedTab])

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
    niche_id: feedTab === 'my_niches' ? undefined : (nicheId ?? undefined),
    stage: stage ?? undefined,
    orientation: orientation ?? undefined,
    min_viral_score: minViralScore ?? undefined,
    sort_by: sortBy ?? undefined,
  })

  const userNicheIds = useMemo(
    () => new Set(activeNiches.map((n) => n.id)),
    [activeNiches],
  )

  const allItems = trendsData?.items ?? []
  const items: TrendItem[] = useMemo(() => {
    if (feedTab !== 'my_niches') return allItems
    return allItems.filter((item) => item.niche_id != null && userNicheIds.has(item.niche_id))
  }, [feedTab, allItems, userNicheIds])

  const handleFeedTabChange = (value: string | null) => {
    updateSearchParams({ feedTab: value === 'all' ? null : value, page: null })
  }

  const handlePageChange = (newPage: number) => {
    updateSearchParams({ page: String(newPage) })
  }

  if (isLoading) return <FeedSkeleton />

  return (
    <Stack gap="md">
      <Tabs value={feedTab} onChange={handleFeedTabChange} variant="pills" radius="sm">
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
        orientation={orientation}
        minViralScore={minViralScore}
        sortBy={sortBy}
        niches={activeNiches}
        onNicheChange={(v) =>
          updateSearchParams({ niche_id: v != null ? String(v) : null, page: null })
        }
        onStageChange={(v) => updateSearchParams({ stage: v, page: null })}
        onOrientationChange={(v) => updateSearchParams({ orientation: v, page: null })}
        onMinViralScoreChange={(v) =>
          updateSearchParams({ min_viral_score: v != null ? String(v) : null, page: null })
        }
        onSortByChange={(v) => updateSearchParams({ sort_by: v, page: null })}
      />

      {isError && <ErrorState onRetry={refetch} />}
      {!isError && items.length === 0 && (
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

/* ─── Niches Tab Content ─────────────────────────────────────────── */

function NichesTabContent({ workspaceId }: { workspaceId: number }) {
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false)
  const [editingNiche, setEditingNiche] = useState<TrendNiche | null>(null)

  const {
    data: nichesData,
    isLoading,
    isError,
    refetch,
  } = useTrendNichesQuery(workspaceId, 1, 100)

  const niches = nichesData?.items ?? []
  const totalCount = niches.length
  const activeCount = niches.filter((n) => n.is_active).length

  function handleCreate() {
    setEditingNiche(null)
    openModal()
  }

  function handleEdit(niche: TrendNiche) {
    setEditingNiche(niche)
    openModal()
  }

  const stats = [
    { label: 'Всего ниш', value: totalCount, icon: IconCategory, color: 'teal' },
    { label: 'Активных', value: activeCount, icon: IconActivity, color: 'green' },
    { label: 'Неактивных', value: totalCount - activeCount, icon: IconTrendingUp, color: 'gray' },
  ]

  if (isLoading) return <NichesSkeleton />

  return (
    <Stack gap="md">
      <Stack gap="md">
        <Group justify="flex-end">
          <Button leftSection={<IconPlus size={16} />} onClick={handleCreate}>
            Добавить нишу
          </Button>
        </Group>
        <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="md">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <Paper
                key={stat.label}
                p="md"
                radius="md"
                className={styles.statCard}
              >
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
        </SimpleGrid>
      </Stack>

      {isError && <ErrorState onRetry={refetch} />}
      {!isError && niches.length === 0 && (
        <EmptyState message="Нет ниш. Нажмите «Добавить нишу» для создания первой." />
      )}

      {!isError && niches.length > 0 && (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {niches.map((niche) => (
            <NicheCard
              key={niche.id}
              niche={niche}
              workspaceId={workspaceId}
              onEdit={handleEdit}
            />
          ))}
        </SimpleGrid>
      )}

      <NicheFormModal
        opened={modalOpened}
        onClose={closeModal}
        workspaceId={workspaceId}
        niche={editingNiche}
      />
    </Stack>
  )
}

/* ─── Alerts Tab Content ─────────────────────────────────────────── */

function AlertsTabContent({ workspaceId }: { workspaceId: number }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const alertSubTab = (searchParams.get('alertTab') as AlertSubTab) || 'history'

  // Check if alerts data is loading to show skeleton
  const { isLoading } = useTrendAlertsQuery(workspaceId, { page: 1, size: 1 })

  const handleAlertTabChange = (value: string | null) => {
    const newParams = new URLSearchParams(searchParams.toString())
    newParams.set('tab', 'alerts')
    if (value && value !== 'history') {
      newParams.set('alertTab', value)
    } else {
      newParams.delete('alertTab')
    }
    router.push(`${pathname}?${newParams.toString()}`)
  }

  if (isLoading) return <AlertsSkeleton />

  return (
    <Stack gap="md">
      <Tabs value={alertSubTab} onChange={handleAlertTabChange} variant="pills" radius="sm">
        <Tabs.List>
          <Tabs.Tab value="history" leftSection={<IconBell size={14} />}>
            История
          </Tabs.Tab>
          <Tabs.Tab value="settings" leftSection={<IconSettings size={14} />}>
            Настройки
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {alertSubTab === 'history' && <AlertHistory workspaceId={workspaceId} />}
      {alertSubTab === 'settings' && <AlertSettings workspaceId={workspaceId} />}
    </Stack>
  )
}

/* ─── Main Trends Page ───────────────────────────────────────────── */

export default function TrendsPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const workspaceId = Number(params.id)
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)

  const activeTab = (searchParams.get('tab') as MainTab) || 'feed'

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
    const newParams = new URLSearchParams()
    if (value && value !== 'feed') {
      newParams.set('tab', value)
    }
    const qs = newParams.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  const breadcrumbs = [
    { label: activeWorkspace?.company_name ?? '' },
    { label: activeWorkspace?.name ?? '', href: `/workspaces/${workspaceId}` },
    { label: 'Тренды' },
  ]

  return (
    <Stack gap="lg">
      <AppBreadcrumbs items={breadcrumbs} />

      <PageHeader
        title="Тренды"
        subtitle="Мониторинг трендов, ниши и алерты"
        actions={[
          <Button
            key="discover"
            leftSection={<IconRadar size={16} />}
            onClick={handleDiscoverNow}
            loading={discoverNow.isPending}
          >
            Обнаружить сейчас
          </Button>,
        ]}
      />

      <Tabs value={activeTab} onChange={handleTabChange} className={styles.mainTabs}>
        <Tabs.List className={styles.mainTabsList}>
          <Tabs.Tab value="feed" leftSection={<IconFlame size={16} />}>
            Лента
          </Tabs.Tab>
          <Tabs.Tab value="niches" leftSection={<IconCategory size={16} />}>
            Ниши
          </Tabs.Tab>
          <Tabs.Tab value="alerts" leftSection={<IconBell size={16} />}>
            Алерты
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="feed" pt="md">
          <FeedTabContent workspaceId={workspaceId} />
        </Tabs.Panel>

        <Tabs.Panel value="niches" pt="md">
          <NichesTabContent workspaceId={workspaceId} />
        </Tabs.Panel>

        <Tabs.Panel value="alerts" pt="md">
          <AlertsTabContent workspaceId={workspaceId} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
