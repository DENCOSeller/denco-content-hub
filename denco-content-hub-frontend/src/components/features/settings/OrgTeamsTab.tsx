'use client'

import { useState } from 'react'
import {
  Stack,
  Group,
  Text,
  Badge,
  Card,
  Button,
  Select,
  ActionIcon,
  Tooltip,
  Accordion,
  Loader,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconTrash, IconPlus, IconUsers, IconFolder } from '@tabler/icons-react'

import {
  useTeamsQuery,
  useTeamWorkspaceAccessQuery,
  useAddTeamWorkspaceAccessMutation,
  useRemoveTeamWorkspaceAccessMutation,
} from '@/api/hooks/useTeams'
import type { TeamResponse } from '@/api/hooks/useTeams'
import { useWorkspacesQuery } from '@/api/hooks/useWorkspaces'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { EmptyState } from '@/components/shared/EmptyState'
import settingsStyles from './settings.module.css'

const roleLabelMap: Record<string, string> = {
  owner: 'Владелец',
  admin: 'Админ',
  editor: 'Редактор',
  viewer: 'Просмотр',
  contractor: 'Подрядчик',
}

const roleColorMap: Record<string, string> = {
  owner: 'contentHubTeal',
  admin: 'violet',
  editor: 'green',
  viewer: 'gray',
  contractor: 'orange',
}

interface OrgTeamsTabProps {
  organizationId: number
}

function TeamWorkspaceAccessPanel({
  team,
  organizationId,
}: {
  team: TeamResponse
  organizationId: number
}) {
  const { data: accessList, isLoading, isError, refetch } = useTeamWorkspaceAccessQuery(organizationId, team.id)
  const { data: workspaces } = useWorkspacesQuery()
  const addAccess = useAddTeamWorkspaceAccessMutation(organizationId, team.id)
  const removeAccess = useRemoveTeamWorkspaceAccessMutation(organizationId, team.id)

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<string>('viewer')

  const availableWorkspaces = (workspaces ?? [])
    .filter(
      (ws) =>
        ws.organization_id === organizationId &&
        !ws.is_personal &&
        !accessList?.some((a) => a.workspace_id === ws.id)
    )
    .map((ws) => ({ value: String(ws.id), label: ws.name }))

  const handleAdd = async () => {
    if (!selectedWorkspaceId) return
    try {
      await addAccess.mutateAsync({
        workspace_id: Number(selectedWorkspaceId),
        default_role: selectedRole,
      })
      setSelectedWorkspaceId(null)
      notifications.show({
        title: 'Доступ добавлен',
        message: 'Воркспейс привязан к команде',
        color: 'green',
      })
    } catch {
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось добавить доступ',
        color: 'red',
      })
    }
  }

  const handleRemove = (workspaceId: number, workspaceName: string) => {
    removeAccess.mutate(workspaceId, {
      onSuccess: () => {
        notifications.show({
          title: 'Доступ отозван',
          message: `Воркспейс "${workspaceName}" отвязан`,
          color: 'green',
        })
      },
      onError: () => {
        notifications.show({
          title: 'Ошибка',
          message: 'Не удалось отозвать доступ',
          color: 'red',
        })
      },
    })
  }

  return (
    <Stack gap="sm">
      {isLoading && <Loader size="sm" />}
      {isError && <ErrorState onRetry={refetch} />}

      {/* Existing access */}
      {accessList && accessList.length > 0 && (
        <Stack gap="xs">
          {accessList.map((access) => (
            <Group key={access.id} justify="space-between" wrap="nowrap" px="xs">
              <Group gap="xs" wrap="nowrap" className="truncateWrap">
                <IconFolder size={14} className="iconMuted noShrink" />
                <Text size="sm" truncate="end">
                  {access.workspace_name}
                </Text>
              </Group>
              <Group gap="xs" wrap="nowrap">
                <Badge
                  color={roleColorMap[access.default_role] ?? 'gray'}
                  variant="light"
                  size="sm"
                >
                  {roleLabelMap[access.default_role] ?? access.default_role}
                </Badge>
                <Tooltip label="Отвязать воркспейс">
                  <ActionIcon
                    variant="light"
                    color="red"
                    size="xs"
                    onClick={() => handleRemove(access.workspace_id, access.workspace_name)}
                    loading={removeAccess.isPending}
                  >
                    <IconTrash size={12} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
          ))}
        </Stack>
      )}

      {accessList && accessList.length === 0 && (
        <Text size="sm" c="dimmed" px="xs">
          Нет привязанных воркспейсов
        </Text>
      )}

      {/* Add access form */}
      <Group gap="xs" px="xs" align="flex-end">
        <Select
          placeholder="Выберите воркспейс"
          data={availableWorkspaces}
          value={selectedWorkspaceId}
          onChange={setSelectedWorkspaceId}
          size="xs"
          className={settingsStyles.wsSelect}
          searchable
          nothingFoundMessage="Нет доступных воркспейсов"
        />
        <Select
          data={[
            { value: 'admin', label: 'Админ' },
            { value: 'editor', label: 'Редактор' },
            { value: 'viewer', label: 'Просмотр' },
          ]}
          value={selectedRole}
          onChange={(v) => v && setSelectedRole(v)}
          size="xs"
          className={settingsStyles.wsRoleSelect}
        />
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPlus size={12} />}
          onClick={handleAdd}
          loading={addAccess.isPending}
          disabled={!selectedWorkspaceId}
        >
          Привязать
        </Button>
      </Group>
    </Stack>
  )
}

export function OrgTeamsTab({ organizationId }: OrgTeamsTabProps) {
  const { data, isLoading, isError, refetch } = useTeamsQuery(organizationId)

  if (isLoading) return <LoadingState />
  if (isError) return <ErrorState onRetry={refetch} />
  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        message="Команды не найдены. Команды создаются в Staff Service и синхронизируются автоматически при входе участников."
      />
    )
  }

  return (
    <Stack gap="md">
      <Text
        c="dimmed"
        tt="uppercase"
        fz="0.7rem"
        fw={600}
        className="overlineLabel"
      >
        Команды организации ({data.total})
      </Text>

      <Accordion variant="separated" radius="md">
        {data.items.map((team) => (
          <Accordion.Item key={team.id} value={String(team.id)}>
            <Accordion.Control>
              <Group gap="sm">
                <IconUsers size={16} className="iconEco" />
                <Text fw={500}>{team.name}</Text>
                <Badge variant="light" color="gray" size="sm">
                  {team.member_count} {team.member_count === 1 ? 'участник' : 'участников'}
                </Badge>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Card padding="sm" radius="sm" className={settingsStyles.teamAccordionCard}>
                <Text size="xs" c="dimmed" mb="sm" fw={600} tt="uppercase" className={settingsStyles.teamLetterSpacing}>
                  Доступ к воркспейсам
                </Text>
                <TeamWorkspaceAccessPanel team={team} organizationId={organizationId} />
              </Card>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Stack>
  )
}
