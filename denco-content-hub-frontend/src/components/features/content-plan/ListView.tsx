'use client'

import { useMemo } from 'react'
import { Stack, Text, Title } from '@mantine/core'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'

import { useContentPlanItemsQuery } from '@/api/hooks/useContentPlan'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { EmptyState } from '@/components/shared/EmptyState'
import type { ContentPlanItemResponse } from '@/api/client/types.gen'

import { PlanItemCard } from './PlanItemCard'
import styles from './list-view.module.css'

dayjs.locale('ru')

interface ListViewProps {
  workspaceId: number
}


interface DayGroup {
  date: string
  label: string
  items: ContentPlanItemResponse[]
}

function groupByDay(items: ContentPlanItemResponse[]): DayGroup[] {
  const map = new Map<string, ContentPlanItemResponse[]>()

  for (const item of items) {
    const key = dayjs(item.scheduled_at).format('YYYY-MM-DD')
    const existing = map.get(key)
    if (existing) {
      existing.push(item)
    } else {
      map.set(key, [item])
    }
  }

  const groups: DayGroup[] = []

  for (const [date, dayItems] of map) {
    groups.push({
      date,
      label: dayjs(date).format('D MMMM YYYY, dddd'),
      items: dayItems.sort(
        (a, b) =>
          new Date(a.scheduled_at).getTime() -
          new Date(b.scheduled_at).getTime(),
      ),
    })
  }

  groups.sort((a, b) => a.date.localeCompare(b.date))

  return groups
}

export function ListView({ workspaceId }: ListViewProps) {
  const { data, isLoading, isError, refetch } = useContentPlanItemsQuery(
    workspaceId,
    { size: 100 },
  )

  const groups = useMemo(
    () => groupByDay(data?.items ?? []),
    [data?.items],
  )

  if (isLoading) return <LoadingState message="Загрузка контент-плана..." />
  if (isError) return <ErrorState onRetry={refetch} />
  if (!groups.length) return <EmptyState message="Нет запланированных публикаций" />

  return (
    <Stack gap="lg">
      {groups.map((group) => (
        <Stack key={group.date} gap="xs" className={styles.dayGroup}>
          <Title order={5} className={styles.dayHeader}>
            {group.label}
          </Title>

          <Stack gap={4}>
            {group.items.map((item) => (
              <PlanItemCard key={item.id} item={item} workspaceId={workspaceId} />
            ))}
          </Stack>
        </Stack>
      ))}
    </Stack>
  )
}
