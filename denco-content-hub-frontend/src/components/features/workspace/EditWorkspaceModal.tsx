'use client'

import { Modal, TextInput, Button, Group, Stack } from '@mantine/core'
import { useForm } from '@mantine/form'
import { zodResolver } from 'mantine-form-zod-resolver'
import { notifications } from '@mantine/notifications'
import { useEffect } from 'react'

import { useUpdateWorkspaceMutation } from '@/api/hooks/useWorkspaces'
import {
  createWorkspaceSchema,
  type CreateWorkspaceFormValues,
} from '@/lib/validations/workspace'
import type { WorkspaceResponse } from '@/api/client/types.gen'

interface EditWorkspaceModalProps {
  workspace: WorkspaceResponse | null
  opened: boolean
  onClose: () => void
}

export function EditWorkspaceModal({ workspace, opened, onClose }: EditWorkspaceModalProps) {
  const updateWorkspace = useUpdateWorkspaceMutation()

  const form = useForm<CreateWorkspaceFormValues>({
    mode: 'uncontrolled',
    initialValues: { name: '' },
    validate: zodResolver(createWorkspaceSchema),
  })

  useEffect(() => {
    if (workspace && opened) {
      form.setValues({ name: workspace.name })
    }
  }, [workspace, opened])

  const handleSubmit = form.onSubmit(async (values) => {
    if (!workspace) return
    try {
      await updateWorkspace.mutateAsync({
        workspaceId: workspace.id,
        data: { name: values.name },
      })
      onClose()
      notifications.show({
        title: 'Воркспейс обновлён',
        message: `Название изменено на "${values.name}"`,
        color: 'green',
      })
    } catch {
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось обновить воркспейс',
        color: 'red',
      })
    }
  })

  return (
    <Modal opened={opened} onClose={onClose} title="Редактировать воркспейс" centered>
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="Название"
            placeholder="Название воркспейса"
            key={form.key('name')}
            {...form.getInputProps('name')}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" loading={updateWorkspace.isPending}>
              Сохранить
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
