'use client'

import {
  Stack,
  Group,
  Text,
  Button,
  UnstyledButton,
  ThemeIcon,
  Box,
} from '@mantine/core'
import {
  IconTrendingUp,
  IconFlame,
  IconUsersPlus,
  IconCheck,
} from '@tabler/icons-react'

import type {
  CompetitorNotification,
  CompetitorNotificationType,
} from '@/api/types/competitor'
import {
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} from '@/api/hooks/useNotifications'
import { EmptyState } from '@/components/shared/EmptyState'

interface NotificationListProps {
  notifications: CompetitorNotification[]
  workspaceId: number
}

const typeConfig: Record<
  CompetitorNotificationType,
  { icon: typeof IconTrendingUp; color: string }
> = {
  new_post: { icon: IconTrendingUp, color: 'blue' },
  viral_post: { icon: IconFlame, color: 'orange' },
  channel_growth: { icon: IconUsersPlus, color: 'teal' },
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'только что'
  if (minutes < 60) return `${minutes} мин назад`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ч назад`
  const days = Math.floor(hours / 24)
  return `${days} дн назад`
}

export function NotificationList({ notifications: items, workspaceId }: NotificationListProps) {
  const markRead = useMarkNotificationReadMutation(workspaceId)
  const markAllRead = useMarkAllNotificationsReadMutation(workspaceId)

  const hasUnread = items.some((n) => !n.is_read)

  if (!items.length) {
    return <EmptyState message="Нет уведомлений" />
  }

  return (
    <Stack gap={0}>
      {hasUnread && (
        <Group justify="flex-end" p="xs">
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconCheck size={14} />}
            onClick={() => markAllRead.mutate()}
            loading={markAllRead.isPending}
          >
            Прочитать все
          </Button>
        </Group>
      )}

      {items.map((notification) => {
        const config = typeConfig[notification.notification_type]
        const Icon = config.icon

        return (
          <UnstyledButton
            key={notification.id}
            onClick={() => {
              if (!notification.is_read) {
                markRead.mutate(notification.id)
              }
            }}
            style={{
              borderBottom: '1px solid var(--mantine-color-dark-4)',
            }}
          >
            <Group
              gap="sm"
              p="sm"
              wrap="nowrap"
              style={{
                backgroundColor: notification.is_read
                  ? 'transparent'
                  : 'var(--mantine-color-dark-6)',
              }}
            >
              <ThemeIcon
                variant="light"
                color={config.color}
                size="md"
                radius="xl"
              >
                <Icon size={14} />
              </ThemeIcon>

              <Box className="flexFill">
                <Text size="sm" fw={notification.is_read ? 400 : 600} truncate>
                  {notification.title}
                </Text>
                <Text size="xs" c="dimmed" lineClamp={2}>
                  {notification.body}
                </Text>
                <Text size="xs" c="dimmed" mt={2}>
                  {formatTimeAgo(notification.created_at)}
                </Text>
              </Box>

              {!notification.is_read && (
                <Box
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: 'var(--mantine-color-blue-5)',
                    flexShrink: 0,
                  }}
                />
              )}
            </Group>
          </UnstyledButton>
        )
      })}
    </Stack>
  )
}
