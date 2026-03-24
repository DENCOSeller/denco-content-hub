'use client'

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

import { useCreateStaffTeamMutation } from '@/api/hooks/useStaffTeams'

interface CreateTeamModalProps {
  opened: boolean
  onClose: () => void
  orgId: number
}

export function CreateTeamModal({ opened, onClose, orgId }: CreateTeamModalProps) {
  const createTeam = useCreateStaffTeamMutation(orgId)
  const form = useForm({
    initialValues: { name: '', description: '' },
    validate: {
      name: (v) => (v.trim().length < 1 ? 'Название обязательно' : null),
    },
  })

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await createTeam.mutateAsync({
        name: values.name.trim(),
        description: values.description.trim() || undefined,
      })
      form.reset()
      onClose()
      notifications.show({
        title: 'Команда создана',
        message: `Команда "${values.name}" создана`,
        color: 'green',
      })
    } catch (err) {
      notifications.show({
        title: 'Ошибка',
        message: (err as Error).message || 'Не удалось создать команду',
        color: 'red',
      })
    }
  })

  return (
    <Modal opened={opened} onClose={onClose} title="Новая команда" centered>
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
            <Button type="submit" loading={createTeam.isPending}>Создать</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
