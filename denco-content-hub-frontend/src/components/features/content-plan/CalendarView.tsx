'use client'

import { useState, useMemo } from 'react'
import {
  ActionIcon,
  Box,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { IconChevronLeft, IconChevronRight, IconPlus } from '@tabler/icons-react'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'

import { useContentPlanItemsQuery } from '@/api/hooks/useContentPlan'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import type { ContentPlanItemResponse } from '@/api/client/types.gen'

import { PlanItemCard } from './PlanItemCard'
import styles from './calendar-view.module.css'

dayjs.locale('ru')

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

interface CalendarViewProps {
  workspaceId: number
  onAddClick?: (date: Date) => void
}

function getMonthDays(year: number, month: number) {
  const firstDay = dayjs().year(year).month(month).startOf('month')
  const lastDay = firstDay.endOf('month')

  const startOfWeek = firstDay.startOf('week')
  const endOfWeek = lastDay.endOf('week')

  const days: dayjs.Dayjs[] = []
  let current = startOfWeek

  while (current.isBefore(endOfWeek) || current.isSame(endOfWeek, 'day')) {
    days.push(current)
    current = current.add(1, 'day')
  }

  return days
}

function groupItemsByDate(
  items: ContentPlanItemResponse[],
): Record<string, ContentPlanItemResponse[]> {
  const map: Record<string, ContentPlanItemResponse[]> = {}

  for (const item of items) {
    const key = dayjs(item.scheduled_at).format('YYYY-MM-DD')
    if (!map[key]) map[key] = []
    map[key].push(item)
  }

  return map
}

export function CalendarView({ workspaceId, onAddClick }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(() => dayjs())

  const year = currentDate.year()
  const month = currentDate.month()

  const dateFrom = dayjs()
    .year(year)
    .month(month)
    .startOf('month')
    .subtract(7, 'day')
    .format('YYYY-MM-DD')

  const dateTo = dayjs()
    .year(year)
    .month(month)
    .endOf('month')
    .add(7, 'day')
    .format('YYYY-MM-DD')

  const { data, isLoading, isError, refetch } = useContentPlanItemsQuery(
    workspaceId,
    {
      date_from: dateFrom,
      date_to: dateTo,
      size: 100,
    },
  )

  const days = useMemo(() => getMonthDays(year, month), [year, month])

  const itemsByDate = useMemo(
    () => groupItemsByDate(data?.items ?? []),
    [data?.items],
  )

  const goToPrev = () => setCurrentDate((d) => d.subtract(1, 'month'))
  const goToNext = () => setCurrentDate((d) => d.add(1, 'month'))
  const goToToday = () => setCurrentDate(dayjs())

  const monthLabel = currentDate.format('MMMM YYYY')

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group gap="sm">
          <ActionIcon variant="subtle" onClick={goToPrev} aria-label="Предыдущий месяц">
            <IconChevronLeft size={18} />
          </ActionIcon>
          <Title order={4} tt="capitalize" w={180} ta="center">
            {monthLabel}
          </Title>
          <ActionIcon variant="subtle" onClick={goToNext} aria-label="Следующий месяц">
            <IconChevronRight size={18} />
          </ActionIcon>
        </Group>

        <Text
          size="sm"
          c="blue"
          className={styles.todayLink}
          onClick={goToToday}
        >
          Сегодня
        </Text>
      </Group>

      {isLoading && <LoadingState message="Загрузка контент-плана..." />}
      {isError && <ErrorState onRetry={refetch} />}

      {!isLoading && !isError && (
        <>
          <SimpleGrid cols={7} spacing={0}>
            {WEEKDAYS.map((day) => (
              <Box key={day} className={styles.weekdayHeader}>
                <Text size="xs" fw={600} c="dimmed" ta="center">
                  {day}
                </Text>
              </Box>
            ))}
          </SimpleGrid>

          <SimpleGrid cols={7} spacing={0}>
            {days.map((day) => {
              const key = day.format('YYYY-MM-DD')
              const dayItems = itemsByDate[key] ?? []
              const isCurrentMonth = day.month() === month
              const isToday = day.isSame(dayjs(), 'day')

              return (
                <Box
                  key={key}
                  className={styles.dayCell}
                  data-today={isToday || undefined}
                  data-other-month={!isCurrentMonth || undefined}
                >
                  <Group justify="space-between" align="center" gap={0}>
                    <Text
                      size="sm"
                      fw={isToday ? 700 : 400}
                      className={isToday ? styles.todayNumber : undefined}
                    >
                      {day.date()}
                    </Text>

                    {onAddClick && (
                      <ActionIcon
                        variant="subtle"
                        size="xs"
                        className={styles.addButton}
                        onClick={(e) => {
                          e.stopPropagation()
                          onAddClick(day.toDate())
                        }}
                        aria-label="Добавить в план"
                      >
                        <IconPlus size={12} />
                      </ActionIcon>
                    )}
                  </Group>

                  <Stack gap={2} mt={4}>
                    {dayItems.slice(0, 3).map((item) => (
                      <PlanItemCard key={item.id} item={item} workspaceId={workspaceId} />
                    ))}
                    {dayItems.length > 3 && (
                      <Text size="10px" c="dimmed" ta="center">
                        +{dayItems.length - 3} ещё
                      </Text>
                    )}
                  </Stack>
                </Box>
              )
            })}
          </SimpleGrid>
        </>
      )}
    </Stack>
  )
}
