'use client'

import {
  Stack,
  Group,
  Text,
  Badge,
  ActionIcon,
  Tooltip,
  Card,
  Avatar,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconX, IconClock } from '@tabler/icons-react'

import {
  useInvitationsQuery,
  useCancelInvitationMutation,
} from '@/api/hooks/useTeam'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { EmptyState } from '@denco/ui'

import { roleLabelMap, roleColorMap } from './constants'
import styles from './settings.module.css'

interface InvitationsTabProps {
  workspaceId: number
}

export function InvitationsTab({ workspaceId }: InvitationsTabProps) {
  const { data, isLoading, isError, refetch } = useInvitationsQuery(workspaceId)
  const cancelInvitation = useCancelInvitationMutation(workspaceId)

  const handleCancel = (invitationId: number, email: string) => {
    cancelInvitation.mutate(invitationId, {
      onSuccess: () => {
        notifications.show({
          title: 'Приглашение отменено',
          message: `Инвайт для ${email} отменен`,
          color: 'green',
        })
      },
      onError: () => {
        notifications.show({
          title: 'Ошибка',
          message: 'Не удалось отменить приглашение',
          color: 'red',
        })
      },
    })
  }

  const pending = data?.items.filter((inv) => inv.status === 'pending') ?? []

  if (isLoading) return <LoadingState />
  if (isError) return <ErrorState onRetry={refetch} />
  if (pending.length === 0) return <EmptyState message="Нет ожидающих приглашений" />

  return (
    <Stack gap="md">
      <Text className={styles.sectionLabel}>
        {pending.length} ожидающих
      </Text>
      <Stack gap="xs">
        {pending.map((inv) => (
          <Card
            key={inv.id}
            padding="sm"
            radius="md"
            className={styles.memberCard}
          >
            <Group justify="space-between" wrap="nowrap">
              <Group gap="sm" wrap="nowrap" className="flexFill">
                <Avatar size="sm" radius="xl" color="gray" variant="light">
                  {inv.email?.charAt(0).toUpperCase() ?? '?'}
                </Avatar>
                <Stack gap={2} className="flexFill">
                  <Text fw={500} c="var(--text-primary)" size="sm" truncate="end">{inv.email}</Text>
                  <Group gap={4} wrap="nowrap">
                    <IconClock size={12} color="var(--text-muted)" />
                    <Text size="xs" c="var(--text-secondary)">
                      Истекает: {new Date(inv.expires_at).toLocaleDateString('ru-RU')}
                    </Text>
                  </Group>
                </Stack>
              </Group>
              <Group gap="xs" wrap="nowrap">
                <Badge color={roleColorMap[inv.role] ?? 'gray'} variant="light" size="sm">
                  {roleLabelMap[inv.role] ?? inv.role}
                </Badge>
                <Tooltip label="Отменить приглашение">
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={() => handleCancel(inv.id, inv.email)}
                    loading={cancelInvitation.isPending && cancelInvitation.variables === inv.id}
                  >
                    <IconX size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
          </Card>
        ))}
      </Stack>
    </Stack>
  )
}
