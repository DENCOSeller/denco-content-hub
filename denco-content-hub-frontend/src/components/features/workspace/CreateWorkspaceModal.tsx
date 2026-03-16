'use client'

import { Modal, TextInput, Button, Group, Stack } from '@mantine/core'
import { useForm } from '@mantine/form'
import { zodResolver } from 'mantine-form-zod-resolver'
import { notifications } from '@mantine/notifications'

import { useCreateWorkspaceMutation } from '@/api/hooks/useWorkspaces'
import {
  createWorkspaceSchema,
  type CreateWorkspaceFormValues,
} from '@/lib/validations/workspace'

interface CreateWorkspaceModalProps {
  opened: boolean
  onClose: () => void
}

export function CreateWorkspaceModal({ opened, onClose }: CreateWorkspaceModalProps) {
  const createWorkspace = useCreateWorkspaceMutation()

  const form = useForm<CreateWorkspaceFormValues>({
    mode: 'uncontrolled',
    initialValues: { name: '' },
    validate: zodResolver(createWorkspaceSchema),
  })

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await createWorkspace.mutateAsync({ name: values.name })
      form.reset()
      onClose()
      notifications.show({
        title: 'Воркспейс создан',
        message: `Воркспейс "${values.name}" успешно создан`,
        color: 'green',
      })
    } catch {
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось создать воркспейс',
        color: 'red',
      })
    }
  })

  return (
    <Modal opened={opened} onClose={onClose} title="Новый воркспейс" centered>
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
            <Button type="submit" loading={createWorkspace.isPending}>
              Создать
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
