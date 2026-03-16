'use client'

import { useState } from 'react'
import {
  Stack,
  Group,
  Text,
  Badge,
  ActionIcon,
  TextInput,
  Select,
  Button,
  Alert,
  Tooltip,
  Card,
  CopyButton,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { zodResolver } from 'mantine-form-zod-resolver'
import { notifications } from '@mantine/notifications'
import {
  IconTrash,
  IconCopy,
  IconCheck,
  IconLink,
} from '@tabler/icons-react'

import {
  useMembersQuery,
  useRemoveMemberMutation,
  useCreateInvitationMutation,
} from '@/api/hooks/useTeam'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { EmptyState } from '@/components/shared/EmptyState'
import type { WorkspaceRole, InvitationResponse } from '@/api/client/types.gen'

import { roleLabelMap, roleColorMap, inviteSchema, type InviteFormValues } from './constants'

interface TeamTabProps {
  workspaceId: number
}

export function TeamTab({ workspaceId }: TeamTabProps) {
  const { data, isLoading, isError, refetch } = useMembersQuery(workspaceId)
  const removeMember = useRemoveMemberMutation(workspaceId)
  const createInvitation = useCreateInvitationMutation(workspaceId)
  const [lastInvite, setLastInvite] = useState<InvitationResponse | null>(null)

  const form = useForm<InviteFormValues>({
    mode: 'uncontrolled',
    initialValues: { email: '', role: 'viewer' },
    validate: zodResolver(inviteSchema),
  })

  const handleInvite = form.onSubmit(async (values) => {
    try {
      const invitation = await createInvitation.mutateAsync({
        email: values.email,
        role: values.role as WorkspaceRole,
      })
      setLastInvite(invitation ?? null)
      form.reset()
      notifications.show({
        title: 'Приглашение создано',
        message: `Ссылка для ${values.email} готова`,
        color: 'green',
      })
    } catch {
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось создать приглашение',
        color: 'red',
      })
    }
  })

  const handleRemove = (memberId: number, name: string) => {
    removeMember.mutate(memberId, {
      onSuccess: () => {
        notifications.show({
          title: 'Удалено',
          message: `${name} удалён из воркспейса`,
          color: 'green',
        })
      },
      onError: () => {
        notifications.show({
          title: 'Ошибка',
          message: 'Не удалось удалить участника',
          color: 'red',
        })
      },
    })
  }

  return (
    <Stack gap="md">
      {/* Invite form */}
      <Card padding="md" radius="md" withBorder style={{ borderColor: 'var(--border-subtle)', background: 'var(--card-bg)' }}>
        <Text fw={500} c="gray.2" mb="sm">Пригласить участника</Text>
        <form onSubmit={handleInvite}>
          <Group align="flex-end" gap="sm">
            <TextInput
              label="Email"
              placeholder="user@example.com"
              style={{ flex: 1 }}
              key={form.key('email')}
              {...form.getInputProps('email')}
            />
            <Select
              label="Роль"
              data={[
                { value: 'admin', label: 'Админ' },
                { value: 'editor', label: 'Редактор' },
                { value: 'viewer', label: 'Просмотр' },
              ]}
              style={{ width: 150 }}
              key={form.key('role')}
              {...form.getInputProps('role')}
            />
            <Button
              type="submit"
              leftSection={<IconLink size={16} />}
              loading={createInvitation.isPending}
            >
              Пригласить
            </Button>
          </Group>
        </form>

        {lastInvite && (
          <Alert
            mt="md"
            color="blue"
            title="Ссылка-приглашение"
            withCloseButton
            onClose={() => setLastInvite(null)}
          >
            <Group gap="xs" wrap="nowrap">
              <Text size="sm" style={{ wordBreak: 'break-all', flex: 1 }}>
                {lastInvite.invite_link}
              </Text>
              <CopyButton value={lastInvite.invite_link} timeout={2000}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? 'Скопировано!' : 'Скопировать'}>
                    <ActionIcon
                      color={copied ? 'teal' : 'blue'}
                      variant="light"
                      onClick={copy}
                      size="sm"
                    >
                      {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>
          </Alert>
        )}
      </Card>

      {/* Members list */}
      <Text
        c="dimmed"
        tt="uppercase"
        fz="0.7rem"
        fw={600}
        style={{ letterSpacing: '1px' }}
      >
        Участники
      </Text>

      {isLoading && <LoadingState />}
      {isError && <ErrorState onRetry={refetch} />}
      {!isLoading && !isError && (!data || data.items.length === 0) && (
        <EmptyState message="Участников пока нет" />
      )}

      {data && data.items.map((member) => (
        <Card
          key={member.id}
          padding="sm"
          radius="md"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}
        >
          <Group justify="space-between" wrap="nowrap">
            <Stack gap={2} style={{ minWidth: 0 }}>
              <Text fw={500} c="gray.1" truncate="end">{member.user_name}</Text>
              <Text size="xs" c="dimmed" truncate="end">{member.user_email}</Text>
            </Stack>
            <Group gap="xs" wrap="nowrap">
              <Badge color={roleColorMap[member.role] ?? 'gray'} variant="light" size="sm">
                {roleLabelMap[member.role] ?? member.role}
              </Badge>
              {member.role !== 'owner' && (
                <Tooltip label="Удалить из воркспейса">
                  <ActionIcon
                    variant="light"
                    color="red"
                    size="sm"
                    onClick={() => handleRemove(member.id, member.user_name)}
                    loading={removeMember.isPending && removeMember.variables === member.id}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          </Group>
        </Card>
      ))}
    </Stack>
  )
}
