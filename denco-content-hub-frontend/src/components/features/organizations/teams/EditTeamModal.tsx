'use client'

import { useEffect } from 'react'
import {
  Modal,
  Stack,
  TextInput,
  Textarea,
  Group,
  Button,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'

import { useUpdateStaffTeamMutation } from '@/api/hooks/useStaffTeams'
import type { StaffTeam } from '@/api/hooks/useStaffTeams'

interface EditTeamModalProps {
  team: StaffTeam | null
  onClose: () => void
  orgId: number
}

export function EditTeamModal({ team, onClose, orgId }: EditTeamModalProps) {
  const updateTeam = useUpdateStaffTeamMutation(orgId, team?.id ?? 0)
  const form = useForm({
    initialValues: {
      name: team?.name ?? '',
      description: team?.description ?? '',
    },
    validate: {
      name: (v) => (v.trim().length < 1 ? 'Название обязательно' : null),
    },
  })

  useEffect(() => {
    if (team) {
      form.setValues({ name: team.name, description: team.description ?? '' })
      form.resetDirty()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team?.id])

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await updateTeam.mutateAsync({
        name: values.name.trim(),
        description: values.description.trim() || undefined,
      })
      onClose()
      notifications.show({
        title: 'Обновлено',
        message: `Команда "${values.name}" обновлена`,
        color: 'green',
      })
    } catch (err) {
      notifications.show({
        title: 'Ошибка',
        message: (err as Error).message || 'Не удалось обновить команду',
        color: 'red',
      })
    }
  })

  return (
    <Modal opened={!!team} onClose={onClose} title="Редактировать команду" centered>
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="Название"
            placeholder="Отдел маркетинга"
            {...form.getInputProps('name')}
          />
          <Textarea
            label="Описание"
            placeholder="Опишите назначение команды"
            autosize
            minRows={2}
            maxRows={4}
            {...form.getInputProps('description')}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>Отмена</Button>
            <Button type="submit" loading={updateTeam.isPending}>Сохранить</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
