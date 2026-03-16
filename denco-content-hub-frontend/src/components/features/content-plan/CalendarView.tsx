'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Popover,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { IconChevronLeft, IconChevronRight, IconPlus } from '@tabler/icons-react'
import { AnimatePresence, motion } from 'motion/react'
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

interface OverflowPopoverProps {
  items: ContentPlanItemResponse[]
  overflow: number
  workspaceId: number
}

function OverflowPopover({ items, overflow, workspaceId }: OverflowPopoverProps) {
  return (
    <Popover width={260} shadow="md" radius="md" position="bottom">
      <Popover.Target>
        <Text
          size="10px"
          c="dimmed"
          ta="center"
          className={styles.overflowLink}
        >
          +{overflow} ещё
        </Text>
      </Popover.Target>
      <Popover.Dropdown p="xs">
        <Stack gap={4}>
          {items.map((item) => (
            <PlanItemCard key={item.id} item={item} workspaceId={workspaceId} />
          ))}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  )
}

export function CalendarView({ workspaceId, onAddClick }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(() => dayjs())
  const [direction, setDirection] = useState(0)

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

  const goToPrev = useCallback(() => {
    setDirection(-1)
    setCurrentDate((d) => d.subtract(1, 'month'))
  }, [])

  const goToNext = useCallback(() => {
    setDirection(1)
    setCurrentDate((d) => d.add(1, 'month'))
  }, [])

  const goToToday = useCallback(() => {
    setDirection(dayjs().isAfter(currentDate) ? 1 : -1)
    setCurrentDate(dayjs())
  }, [currentDate])

  const monthLabel = currentDate.format('MMMM YYYY')

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group gap="xs">
          <ActionIcon variant="subtle" radius="xl" onClick={goToPrev} aria-label="Предыдущий месяц">
            <IconChevronLeft size={18} />
          </ActionIcon>
          <Title order={4} tt="capitalize" w={180} ta="center">
            {monthLabel}
          </Title>
          <ActionIcon variant="subtle" radius="xl" onClick={goToNext} aria-label="Следующий месяц">
            <IconChevronRight size={18} />
          </ActionIcon>
        </Group>

        <Button
          variant="light"
          radius="xl"
          size="xs"
          onClick={goToToday}
        >
          Сегодня
        </Button>
      </Group>

      {isLoading && <LoadingState message="Загрузка контент-плана..." />}
      {isError && <ErrorState onRetry={refetch} />}

      {!isLoading && !isError && (
        <>
          <div className={styles.weekdayGrid}>
            {WEEKDAYS.map((day) => (
              <Box key={day} className={styles.weekdayHeader}>
                <Text size="xs" fw={600} c="dimmed" ta="center">
                  {day}
                </Text>
              </Box>
            ))}
          </div>

          <div className={styles.gridWrapper}>
            <AnimatePresence initial={false} mode="popLayout" custom={direction}>
              <motion.div
                key={`${year}-${month}`}
                className={styles.calendarGrid}
                custom={direction}
                initial={{ x: `${direction * 100}%`, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: `${direction * -100}%`, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
              >
                {days.map((day) => {
                  const key = day.format('YYYY-MM-DD')
                  const dayItems = itemsByDate[key] ?? []
                  const isCurrentMonth = day.month() === month
                  const isToday = day.isSame(dayjs(), 'day')
                  const weekday = day.day()
                  const isWeekend = weekday === 0 || weekday === 6
                  const maxVisible = 3
                  const overflow = dayItems.length - maxVisible
                  const isEmpty = dayItems.length === 0

                  return (
                    <Box
                      key={key}
                      className={styles.dayCell}
                      data-today={isToday || undefined}
                      data-other-month={!isCurrentMonth || undefined}
                      data-weekend={isWeekend || undefined}
                      data-empty={isEmpty || undefined}
                      pos="relative"
                    >
                      <Group justify="space-between" align="center" gap={0}>
                        {isToday ? (
                          <span className={styles.todayCircle}>{day.date()}</span>
                        ) : (
                          <Text size="sm">{day.date()}</Text>
                        )}
                      </Group>

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

                      {isEmpty && isCurrentMonth && (
                        <div className={styles.emptyZone} />
                      )}

                      <Stack gap={2} mt={4}>
                        {dayItems.slice(0, maxVisible).map((item) => (
                          <PlanItemCard key={item.id} item={item} workspaceId={workspaceId} />
                        ))}
                        {overflow > 0 && (
                          <OverflowPopover
                            items={dayItems}
                            overflow={overflow}
                            workspaceId={workspaceId}
                          />
                        )}
                      </Stack>
                    </Box>
                  )
                })}
              </motion.div>
            </AnimatePresence>
          </div>
        </>
      )}
    </Stack>
  )
}
