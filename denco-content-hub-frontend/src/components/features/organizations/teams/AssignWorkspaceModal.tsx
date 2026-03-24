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

import { useAssignTeamWorkspaceMutation } from '@/api/hooks/useStaffTeams'
import { WS_ROLE_OPTIONS } from './constants'

interface AssignWorkspaceModalProps {
  opened: boolean
  onClose: () => void
  orgId: number
  teamId: number
}

export function AssignWorkspaceModal({ opened, onClose, orgId, teamId }: AssignWorkspaceModalProps) {
  const assignWorkspace = useAssignTeamWorkspaceMutation(orgId, teamId)
  const form = useForm({
    initialValues: { workspace_id: '' as string, default_role: 'viewer' },
    validate: {
      workspace_id: (v) => (!v || Number(v) < 1 ? 'Введите ID воркспейса' : null),
    },
  })

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await assignWorkspace.mutateAsync({
        workspace_id: Number(values.workspace_id),
        default_role: values.default_role,
      })
      form.reset()
      onClose()
      notifications.show({
        title: 'Воркспейс привязан',
        message: 'Воркспейс добавлен к команде',
        color: 'green',
      })
    } catch (err) {
      notifications.show({
        title: 'Ошибка',
        message: (err as Error).message || 'Не удалось привязать воркспейс',
        color: 'red',
      })
    }
  })

  return (
    <Modal opened={opened} onClose={onClose} title="Привязать воркспейс" centered>
      <form onSubmit={handleSubmit}>
        <Stack>
          <NumberInput
            label="ID воркспейса"
            placeholder="Введите Workspace ID"
            min={1}
            value={form.values.workspace_id ? Number(form.values.workspace_id) : ''}
            onChange={(val) => form.setFieldValue('workspace_id', String(val))}
            error={form.errors.workspace_id}
          />
          <Select
            label="Роль по умолчанию"
            data={WS_ROLE_OPTIONS}
            {...form.getInputProps('default_role')}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>Отмена</Button>
            <Button type="submit" loading={assignWorkspace.isPending}>Привязать</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
