'use client'

import {
  Stack,
  Group,
  Text,
  Badge,
  ActionIcon,
  Tooltip,
  Card,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconX } from '@tabler/icons-react'

import {
  useInvitationsQuery,
  useCancelInvitationMutation,
} from '@/api/hooks/useTeam'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { EmptyState } from '@/components/shared/EmptyState'

import { roleLabelMap, roleColorMap } from './constants'

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
          message: `Инвайт для ${email} отменён`,
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
    <Stack gap="sm">
      <Text
        c="dimmed"
        tt="uppercase"
        fz="0.7rem"
        fw={600}
        style={{ letterSpacing: '1px' }}
      >
        {pending.length} ожидающих
      </Text>
      {pending.map((inv) => (
        <Card
          key={inv.id}
          padding="sm"
          radius="md"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}
        >
          <Group justify="space-between" wrap="nowrap">
            <Stack gap={2} style={{ minWidth: 0 }}>
              <Text fw={500} c="gray.1" truncate="end">{inv.email}</Text>
              <Text size="xs" c="dimmed">
                Истекает: {new Date(inv.expires_at).toLocaleDateString('ru-RU')}
              </Text>
            </Stack>
            <Group gap="xs" wrap="nowrap">
              <Badge color={roleColorMap[inv.role] ?? 'gray'} variant="light" size="sm">
                {roleLabelMap[inv.role] ?? inv.role}
              </Badge>
              <Tooltip label="Отменить приглашение">
                <ActionIcon
                  variant="light"
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
  )
}
