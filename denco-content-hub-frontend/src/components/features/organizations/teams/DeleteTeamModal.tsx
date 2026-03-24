'use client'

import {
  Modal,
  Stack,
  Text,
  Group,
  Button,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'

import { useDeleteStaffTeamMutation } from '@/api/hooks/useStaffTeams'
import type { StaffTeam } from '@/api/hooks/useStaffTeams'

interface DeleteTeamModalProps {
  team: StaffTeam | null
  onClose: () => void
  orgId: number
}

export function DeleteTeamModal({ team, onClose, orgId }: DeleteTeamModalProps) {
  const deleteTeam = useDeleteStaffTeamMutation(orgId)

  const handleDelete = async () => {
    if (!team) return
    try {
      await deleteTeam.mutateAsync(team.id)
      onClose()
      notifications.show({
        title: 'Удалено',
        message: `Команда "${team.name}" удалена`,
        color: 'green',
      })
    } catch (err) {
      notifications.show({
        title: 'Ошибка',
        message: (err as Error).message || 'Не удалось удалить команду',
        color: 'red',
      })
    }
  }

  return (
    <Modal opened={!!team} onClose={onClose} title="Удалить команду" centered>
      <Stack>
        <Text size="sm">
          Удалить команду <strong>{team?.name}</strong>? Это действие нельзя отменить.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Отмена</Button>
          <Button color="red" onClick={handleDelete} loading={deleteTeam.isPending}>Удалить</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
