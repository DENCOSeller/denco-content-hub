'use client'

import { useMemo } from 'react'
import {
  ActionIcon,
  Indicator,
  Popover,
  ScrollArea,
  Text,
  Tooltip,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconBell } from '@tabler/icons-react'

import { useCompetitorNotificationsQuery } from '@/api/hooks/useNotifications'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { NotificationList } from '@/components/features/competitors/NotificationList'

export function NotificationBell() {
  const [opened, { toggle, close }] = useDisclosure(false)
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)
  const workspaceId = activeWorkspace?.id ?? 0

  const { data: notifications } = useCompetitorNotificationsQuery(workspaceId)

  const unreadCount = useMemo(
    () => (notifications ?? []).filter((n) => !n.is_read).length,
    [notifications],
  )

  if (!workspaceId) return null

  return (
    <Popover
      opened={opened}
      onClose={close}
      width={380}
      position="bottom-end"
      shadow="lg"
      withArrow
    >
      <Popover.Target>
        <Tooltip label="Уведомления" position="bottom">
          <Indicator
            disabled={unreadCount === 0}
            label={unreadCount > 99 ? '99+' : unreadCount}
            size={16}
            offset={4}
            color="red"
          >
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={toggle}
              aria-label="Уведомления"
            >
              <IconBell size={20} />
            </ActionIcon>
          </Indicator>
        </Tooltip>
      </Popover.Target>

      <Popover.Dropdown
        p={0}
        style={{
          backgroundColor: 'var(--mantine-color-dark-7)',
          border: '1px solid var(--mantine-color-dark-4)',
        }}
      >
        <Text fw={600} size="sm" p="sm" pb={0}>
          Уведомления конкурентов
        </Text>
        <ScrollArea.Autosize mah={400}>
          <NotificationList
            notifications={notifications ?? []}
            workspaceId={workspaceId}
          />
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  )
}
