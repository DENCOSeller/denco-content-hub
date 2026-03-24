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
  Avatar,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { zodResolver } from 'mantine-form-zod-resolver'
import { notifications } from '@mantine/notifications'
import {
  IconTrash,
  IconCopy,
  IconCheck,
  IconLink,
  IconUserPlus,
} from '@tabler/icons-react'

import {
  useMembersQuery,
  useRemoveMemberMutation,
  useCreateInvitationMutation,
} from '@/api/hooks/useTeam'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { EmptyState } from '@denco/ui'
import type { WorkspaceRole, InvitationResponse } from '@/api/client/types.gen'

import { roleLabelMap, roleColorMap, inviteSchema, type InviteFormValues } from './constants'
import styles from './settings.module.css'

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
          message: `${name} удален из воркспейса`,
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
      <Card padding="lg" radius="md" className={styles.inviteCard}>
        <Group gap="xs" mb="md">
          <IconUserPlus size={18} color="var(--eco-content)" />
          <Text fw={500} c="var(--text-primary)" size="sm">Пригласить участника</Text>
        </Group>
        <form onSubmit={handleInvite}>
          <Group align="flex-end" gap="sm" wrap="wrap">
            <TextInput
              label="Email"
              placeholder="user@example.com"
              className={styles.emailInput}
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
              className={styles.roleSelect}
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
            color="teal"
            title="Ссылка-приглашение"
            withCloseButton
            onClose={() => setLastInvite(null)}
          >
            <Group gap="xs" wrap="nowrap">
              <Text size="sm" className={styles.inviteLink}>
                {lastInvite.invite_link}
              </Text>
              <CopyButton value={lastInvite.invite_link} timeout={2000}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? 'Скопировано' : 'Скопировать'}>
                    <ActionIcon
                      color={copied ? 'teal' : 'gray'}
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
      <Text className={styles.sectionLabel}>
        Участники
      </Text>

      {isLoading && <LoadingState />}
      {isError && <ErrorState onRetry={refetch} />}
      {!isLoading && !isError && (!data || data.items.length === 0) && (
        <EmptyState message="Участников пока нет" />
      )}

      <Stack gap="xs">
        {data && data.items.map((member) => (
          <Card
            key={member.id}
            padding="sm"
            radius="md"
            className={styles.memberCard}
          >
            <Group justify="space-between" wrap="nowrap">
              <Group gap="sm" wrap="nowrap" className="flexFill">
                <Avatar size="sm" radius="xl" color="contentHubTeal" variant="light">
                  {member.user_name?.charAt(0).toUpperCase() ?? '?'}
                </Avatar>
                <Stack gap={2} className="flexFill">
                  <Text fw={500} c="var(--text-primary)" size="sm" truncate="end">{member.user_name}</Text>
                  <Text size="xs" c="var(--text-secondary)" truncate="end">{member.user_email}</Text>
                </Stack>
              </Group>
              <Group gap="xs" wrap="nowrap">
                <Badge
                  color={roleColorMap[member.role] ?? 'gray'}
                  variant="light"
                  size="sm"
                  className={styles.roleBadge}
                >
                  {roleLabelMap[member.role] ?? member.role}
                </Badge>
                {member.role !== 'owner' && (
                  <Tooltip label="Удалить из воркспейса">
                    <ActionIcon
                      variant="subtle"
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
    </Stack>
  )
}
