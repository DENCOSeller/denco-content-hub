'use client'

import { useState } from 'react'
import {
  Stack,
  Group,
  Text,
  Button,
  Table,
  Badge,
  Avatar,
  Select,
  ActionIcon,
  Tooltip,
  Card,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
  IconArrowLeft,
  IconUserPlus,
  IconWorld,
  IconTrash,
} from '@tabler/icons-react'

import { PageHeader } from '@denco/ui'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { EmptyState } from '@denco/ui'

import {
  useStaffTeamDetailQuery,
  useUpdateTeamMemberMutation,
  useRemoveTeamMemberMutation,
  useRemoveTeamWorkspaceMutation,
} from '@/api/hooks/useStaffTeams'
import type {
  StaffTeamMember,
  StaffTeamWorkspaceAccess,
} from '@/api/hooks/useStaffTeams'

import { TEAM_ROLE_OPTIONS } from './constants'
import { AddMemberModal } from './AddMemberModal'
import { AssignWorkspaceModal } from './AssignWorkspaceModal'
import { ConfirmModal } from './ConfirmModal'
import styles from './teams.module.css'

interface TeamDetailPanelProps {
  orgId: number
  teamId: number
  onBack: () => void
}

export function TeamDetailPanel({ orgId, teamId, onBack }: TeamDetailPanelProps) {
  const { data: team, isLoading, isError, refetch } = useStaffTeamDetailQuery(orgId, teamId)
  const updateMember = useUpdateTeamMemberMutation(orgId, teamId)
  const removeMember = useRemoveTeamMemberMutation(orgId, teamId)
  const removeWorkspace = useRemoveTeamWorkspaceMutation(orgId, teamId)

  const [addMemberOpened, { open: openAddMember, close: closeAddMember }] = useDisclosure(false)
  const [assignWsOpened, { open: openAssignWs, close: closeAssignWs }] = useDisclosure(false)
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<StaffTeamMember | null>(null)
  const [confirmRemoveWs, setConfirmRemoveWs] = useState<StaffTeamWorkspaceAccess | null>(null)
  const [deletingMemberId, setDeletingMemberId] = useState<number | null>(null)
  const [deletingWsId, setDeletingWsId] = useState<number | null>(null)

  const handleRoleChange = async (member: StaffTeamMember, newRole: string) => {
    try {
      await updateMember.mutateAsync({ memberId: member.id, data: { team_role: newRole } })
      notifications.show({
        title: 'Обновлено',
        message: `Роль ${member.full_name} изменена`,
        color: 'green',
      })
    } catch (err) {
      notifications.show({
        title: 'Ошибка',
        message: (err as Error).message || 'Не удалось изменить роль',
        color: 'red',
      })
    }
  }

  const handleRemoveMember = async (member: StaffTeamMember) => {
    setDeletingMemberId(member.id)
    try {
      await removeMember.mutateAsync(member.id)
      notifications.show({
        title: 'Удалено',
        message: `${member.full_name} удален из команды`,
        color: 'green',
      })
    } catch (err) {
      notifications.show({
        title: 'Ошибка',
        message: (err as Error).message || 'Не удалось удалить участника',
        color: 'red',
      })
    } finally {
      setDeletingMemberId(null)
      setConfirmRemoveMember(null)
    }
  }

  const handleRemoveWorkspace = async (access: StaffTeamWorkspaceAccess) => {
    setDeletingWsId(access.id)
    try {
      await removeWorkspace.mutateAsync(access.id)
      notifications.show({
        title: 'Отвязано',
        message: 'Воркспейс отвязан от команды',
        color: 'green',
      })
    } catch (err) {
      notifications.show({
        title: 'Ошибка',
        message: (err as Error).message || 'Не удалось отвязать воркспейс',
        color: 'red',
      })
    } finally {
      setDeletingWsId(null)
      setConfirmRemoveWs(null)
    }
  }

  if (isLoading) return <LoadingState message="Загрузка команды..." />
  if (isError) return <ErrorState message="Не удалось загрузить команду" onRetry={refetch} />
  if (!team) return <EmptyState message="Команда не найдена" />

  return (
    <Stack gap="lg">
      <Button
        variant="subtle"
        leftSection={<IconArrowLeft size={16} />}
        onClick={onBack}
        color="gray"
        size="sm"
        style={{ alignSelf: 'flex-start' }}
      >
        Назад к командам
      </Button>

      <PageHeader
        title={team.name}
        subtitle={team.description || `slug: ${team.slug}`}
      />

      {team.description && (
        <Text size="xs" c="var(--text-muted)">
          slug: {team.slug} | создана: {new Date(team.created_at).toLocaleDateString('ru-RU')}
        </Text>
      )}
      {!team.description && (
        <Text size="xs" c="var(--text-muted)" mt={-12}>
          Создана: {new Date(team.created_at).toLocaleDateString('ru-RU')}
        </Text>
      )}

      {/* Members */}
      <Card padding="md" radius="md" className={styles.sectionCard}>
        <Group justify="space-between" mb="md">
          <Text className={styles.sectionTitle}>
            Участники ({team.members?.length ?? 0})
          </Text>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconUserPlus size={14} />}
            onClick={openAddMember}
          >
            Добавить
          </Button>
        </Group>

        {(!team.members || team.members.length === 0) ? (
          <EmptyState message="Нет участников" />
        ) : (
          <div className={styles.tableWrap}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Сотрудник</Table.Th>
                  <Table.Th>Email</Table.Th>
                  <Table.Th>Роль</Table.Th>
                  <Table.Th w={60} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {team.members.map((member) => (
                  <Table.Tr key={member.id}>
                    <Table.Td>
                      <Group gap="sm" wrap="nowrap">
                        <Avatar size="sm" radius="xl" color="contentHubTeal" variant="light">
                          {member.full_name?.charAt(0).toUpperCase() ?? '?'}
                        </Avatar>
                        <Text size="sm" fw={500}>{member.full_name}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="var(--text-secondary)">{member.email}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Select
                        size="xs"
                        data={TEAM_ROLE_OPTIONS}
                        value={member.team_role}
                        onChange={(val) => val && handleRoleChange(member, val)}
                        w={160}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Tooltip label="Удалить из команды">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          onClick={() => setConfirmRemoveMember(member)}
                          loading={deletingMemberId === member.id}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
        )}
      </Card>

      {/* Workspace Access */}
      <Card padding="md" radius="md" className={styles.sectionCard}>
        <Group justify="space-between" mb="md">
          <Text className={styles.sectionTitle}>
            Воркспейсы ({team.workspace_accesses?.length ?? 0})
          </Text>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconWorld size={14} />}
            onClick={openAssignWs}
          >
            Привязать
          </Button>
        </Group>

        {(!team.workspace_accesses || team.workspace_accesses.length === 0) ? (
          <EmptyState message="Нет привязанных воркспейсов" />
        ) : (
          <div className={styles.tableWrap}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Воркспейс</Table.Th>
                  <Table.Th>Роль по умолчанию</Table.Th>
                  <Table.Th>Дата</Table.Th>
                  <Table.Th w={60} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {team.workspace_accesses.map((ws) => (
                  <Table.Tr key={ws.id}>
                    <Table.Td>
                      <Group gap="sm" wrap="nowrap">
                        <IconWorld size={16} color="var(--eco-content)" />
                        <Text size="sm">{ws.workspace_name ?? `ID: ${ws.workspace_id}`}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="sm" variant="light" color="contentHubTeal">
                        {ws.default_role}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="var(--text-secondary)">
                        {new Date(ws.created_at).toLocaleDateString('ru-RU')}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Tooltip label="Отвязать">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          onClick={() => setConfirmRemoveWs(ws)}
                          loading={deletingWsId === ws.id}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
        )}
      </Card>

      <AddMemberModal
        opened={addMemberOpened}
        onClose={closeAddMember}
        orgId={orgId}
        teamId={teamId}
      />
      <AssignWorkspaceModal
        opened={assignWsOpened}
        onClose={closeAssignWs}
        orgId={orgId}
        teamId={teamId}
      />

      <ConfirmModal
        opened={!!confirmRemoveMember}
        onClose={() => setConfirmRemoveMember(null)}
        title="Удалить участника"
        confirmLabel="Удалить"
        onConfirm={() => confirmRemoveMember && handleRemoveMember(confirmRemoveMember)}
        loading={removeMember.isPending}
      >
        Удалить <strong>{confirmRemoveMember?.full_name}</strong> из команды?
      </ConfirmModal>

      <ConfirmModal
        opened={!!confirmRemoveWs}
        onClose={() => setConfirmRemoveWs(null)}
        title="Отвязать воркспейс"
        confirmLabel="Отвязать"
        onConfirm={() => confirmRemoveWs && handleRemoveWorkspace(confirmRemoveWs)}
        loading={removeWorkspace.isPending}
      >
        Отвязать воркспейс <strong>{confirmRemoveWs?.workspace_name ?? `ID: ${confirmRemoveWs?.workspace_id}`}</strong> от команды?
      </ConfirmModal>
    </Stack>
  )
}
