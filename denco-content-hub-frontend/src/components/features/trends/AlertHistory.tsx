'use client'

import { useState } from 'react'
import {
  Stack,
  Group,
  Text,
  Button,
  Switch,
  Pagination,
  ThemeIcon,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconFlame,
  IconTrendingUp,
  IconChartBar,
} from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/ru'

import type { TrendAlert, TrendAlertType } from '@/api/types/trend'
import {
  useTrendAlertsQuery,
  useMarkAlertReadMutation,
  useMarkAllAlertsReadMutation,
} from '@/api/hooks/useTrends'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { EmptyState } from '@/components/shared/EmptyState'

import styles from './AlertHistory.module.css'

dayjs.extend(relativeTime)
dayjs.locale('ru')

interface AlertHistoryProps {
  workspaceId: number
}

const ALERT_ICON: Record<TrendAlertType, typeof IconFlame> = {
  viral_trend: IconFlame,
  new_trend: IconTrendingUp,
  niche_spike: IconChartBar,
}

const ALERT_COLOR: Record<TrendAlertType, string> = {
  viral_trend: 'orange',
  new_trend: 'blue',
  niche_spike: 'violet',
}

const PAGE_SIZE = 20

export function AlertHistory({ workspaceId }: AlertHistoryProps) {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [unreadOnly, setUnreadOnly] = useState(false)

  const { data, isLoading, isError, refetch } = useTrendAlertsQuery(workspaceId, {
    page,
    size: PAGE_SIZE,
    unread_only: unreadOnly || undefined,
  })
  const markRead = useMarkAlertReadMutation(workspaceId)
  const markAllRead = useMarkAllAlertsReadMutation(workspaceId)

  function handleAlertClick(alert: TrendAlert) {
    if (!alert.is_read) {
      markRead.mutate(alert.id)
    }
    if (alert.trend_item_id) {
      router.push(`/workspaces/${workspaceId}/trends/${alert.trend_item_id}`)
    }
  }

  function handleMarkAllRead() {
    markAllRead.mutate(undefined, {
      onSuccess: () => {
        notifications.show({
          title: 'Готово',
          message: 'Все алерты отмечены прочитанными',
          color: 'green',
        })
      },
      onError: () => {
        notifications.show({
          title: 'Ошибка',
          message: 'Не удалось отметить алерты',
          color: 'red',
        })
      },
    })
  }

  if (isLoading) return <LoadingState />
  if (isError) return <ErrorState onRetry={refetch} />

  const alerts = data?.items ?? []
  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Switch
          label="Только непрочитанные"
          checked={unreadOnly}
          onChange={(e) => {
            setUnreadOnly(e.currentTarget.checked)
            setPage(1)
          }}
        />
        <Button
          variant="light"
          size="xs"
          onClick={handleMarkAllRead}
          loading={markAllRead.isPending}
        >
          Отметить все прочитанными
        </Button>
      </Group>

      {!alerts.length ? (
        <EmptyState message="Нет алертов" />
      ) : (
        <Stack gap={4}>
          {alerts.map((alert) => {
            const Icon = ALERT_ICON[alert.alert_type]
            const color = ALERT_COLOR[alert.alert_type]
            return (
              <Group
                key={alert.id}
                gap="sm"
                wrap="nowrap"
                align="flex-start"
                className={`${styles.alertItem} ${!alert.is_read ? styles.unread : ''}`}
                onClick={() => handleAlertClick(alert)}
              >
                <ThemeIcon variant="light" color={color} size="md" mt={2}>
                  <Icon size={16} />
                </ThemeIcon>
                <Stack gap={2} className="flexFill">
                  <Text
                    size="sm"
                    fw={alert.is_read ? 400 : 700}
                    truncate="end"
                  >
                    {alert.title}
                  </Text>
                  {alert.body && (
                    <Text size="xs" c="dimmed" lineClamp={2}>
                      {alert.body}
                    </Text>
                  )}
                </Stack>
                <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                  {dayjs(alert.created_at).fromNow()}
                </Text>
              </Group>
            )
          })}
        </Stack>
      )}

      {totalPages > 1 && (
        <Group justify="center">
          <Pagination
            value={page}
            onChange={setPage}
            total={totalPages}
          />
        </Group>
      )}
    </Stack>
  )
}
