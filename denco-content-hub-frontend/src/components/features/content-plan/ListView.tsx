'use client'

import { useMemo } from 'react'
import { Stack, Text, Title, Badge } from '@mantine/core'
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

function pluralize(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100
  const lastDigit = abs % 10
  if (abs > 10 && abs < 20) return many
  if (lastDigit > 1 && lastDigit < 5) return few
  if (lastDigit === 1) return one
  return many
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'var(--text-tertiary)',
  scheduled: 'var(--eco-content)',
  published: '#22c55e',
  cancelled: 'var(--color-error)',
}

interface ListViewProps {
  workspaceId: number
  selectable?: boolean
  selectedIds?: Set<number>
  onSelect?: (id: number) => void
}

interface DayGroup {
  date: string
  label: string
  isToday: boolean
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
  const today = dayjs().format('YYYY-MM-DD')

  for (const [date, dayItems] of map) {
    groups.push({
      date,
      label: dayjs(date).format('D MMMM YYYY, dddd'),
      isToday: date === today,
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

function getGroupStatusColor(items: ContentPlanItemResponse[]): string {
  // Use the "highest priority" status color for the group border
  const statuses = new Set(items.map((i) => i.status))
  if (statuses.has('published')) return STATUS_COLOR.published
  if (statuses.has('scheduled')) return STATUS_COLOR.scheduled
  if (statuses.has('draft')) return STATUS_COLOR.draft
  return STATUS_COLOR.cancelled
}

export function ListView({ workspaceId, selectable, selectedIds, onSelect }: ListViewProps) {
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
        <Stack
          key={group.date}
          gap="xs"
          className={styles.dayGroup}
          style={{
            '--group-color': getGroupStatusColor(group.items),
          } as React.CSSProperties}
        >
          <div className={styles.dayHeader}>
            <Title order={5} className={styles.dayTitle}>
              {group.label}
            </Title>
            {group.isToday && (
              <Badge size="xs" color="teal" variant="light" className={styles.todayBadge}>
                Сегодня
              </Badge>
            )}
            <Text size="xs" c="dimmed" className={styles.itemCount}>
              {group.items.length} {pluralize(group.items.length, 'элемент', 'элемента', 'элементов')}
            </Text>
          </div>

          <Stack gap={4}>
            {group.items.map((item) => (
              <PlanItemCard
                key={item.id}
                item={item}
                workspaceId={workspaceId}
                variant="expanded"
                selectable={selectable}
                selected={selectedIds?.has(item.id)}
                onSelect={onSelect}
              />
            ))}
          </Stack>
        </Stack>
      ))}
    </Stack>
  )
}
