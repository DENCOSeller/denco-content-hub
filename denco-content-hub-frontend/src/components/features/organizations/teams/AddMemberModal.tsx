'use client'

import {
  Modal,
  Stack,
  NumberInput,
  Select,
  Group,
  Button,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'

import { useAddTeamMemberMutation } from '@/api/hooks/useStaffTeams'
import { TEAM_ROLE_OPTIONS } from './constants'

interface AddMemberModalProps {
  opened: boolean
  onClose: () => void
  orgId: number
  teamId: number
}

export function AddMemberModal({ opened, onClose, orgId, teamId }: AddMemberModalProps) {
  const addMember = useAddTeamMemberMutation(orgId, teamId)
  const form = useForm({
    initialValues: { staff_id: '' as string, team_role: 'team_member' },
    validate: {
      staff_id: (v) => (!v || Number(v) < 1 ? 'Введите ID сотрудника' : null),
    },
  })

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await addMember.mutateAsync({
        staff_id: Number(values.staff_id),
        team_role: values.team_role,
      })
      form.reset()
      onClose()
      notifications.show({
        title: 'Участник добавлен',
        message: 'Сотрудник добавлен в команду',
        color: 'green',
      })
    } catch (err) {
      notifications.show({
        title: 'Ошибка',
        message: (err as Error).message || 'Не удалось добавить участника',
        color: 'red',
      })
    }
  })

  return (
    <Modal opened={opened} onClose={onClose} title="Добавить участника" centered>
      <form onSubmit={handleSubmit}>
        <Stack>
          <NumberInput
            label="ID сотрудника"
            placeholder="Введите Staff ID"
            min={1}
            value={form.values.staff_id ? Number(form.values.staff_id) : ''}
            onChange={(val) => form.setFieldValue('staff_id', String(val))}
            error={form.errors.staff_id}
          />
          <Select
            label="Роль в команде"
            data={TEAM_ROLE_OPTIONS}
            {...form.getInputProps('team_role')}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>Отмена</Button>
            <Button type="submit" loading={addMember.isPending}>Добавить</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
