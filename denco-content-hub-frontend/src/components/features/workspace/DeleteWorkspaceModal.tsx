'use client'

import { Modal, Text, Button, Group, Stack, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'

import { useDeleteWorkspaceMutation } from '@/api/hooks/useWorkspaces'
import type { WorkspaceResponse } from '@/api/client/types.gen'

interface DeleteWorkspaceModalProps {
  workspace: WorkspaceResponse | null
  opened: boolean
  onClose: () => void
}

export function DeleteWorkspaceModal({ workspace, opened, onClose }: DeleteWorkspaceModalProps) {
  const deleteWorkspace = useDeleteWorkspaceMutation()
  const [confirmation, setConfirmation] = useState('')

  const isConfirmed = confirmation === workspace?.name

  const handleDelete = async () => {
    if (!workspace || !isConfirmed) return
    try {
      await deleteWorkspace.mutateAsync(workspace.id)
      setConfirmation('')
      onClose()
      notifications.show({
        title: 'Воркспейс удалён',
        message: `Воркспейс "${workspace.name}" удалён`,
        color: 'green',
      })
    } catch {
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось удалить воркспейс',
        color: 'red',
      })
    }
  }

  const handleClose = () => {
    setConfirmation('')
    onClose()
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Удалить воркспейс" centered>
      <Stack>
        <Text size="sm">
          Это действие необратимо. Все данные воркспейса будут удалены.
        </Text>
        <Text size="sm">
          Введите <Text span fw={700}>{workspace?.name}</Text> для подтверждения:
        </Text>
        <TextInput
          placeholder={workspace?.name}
          value={confirmation}
          onChange={(e) => setConfirmation(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={handleClose}>
            Отмена
          </Button>
          <Button
            color="red"
            onClick={handleDelete}
            disabled={!isConfirmed}
            loading={deleteWorkspace.isPending}
          >
            Удалить
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
