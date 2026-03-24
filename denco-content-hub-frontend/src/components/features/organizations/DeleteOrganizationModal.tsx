'use client'

import {
  Modal,
  Stack,
  Text,
  Group,
  Button,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'

import { useDeleteOrganizationMutation } from '@/api/hooks/useOrganizations'
import type { OrganizationResponse } from '@/api/client/types.gen'

interface DeleteOrganizationModalProps {
  organization: OrganizationResponse | null
  onClose: () => void
}

export function DeleteOrganizationModal({ organization, onClose }: DeleteOrganizationModalProps) {
  const deleteOrganization = useDeleteOrganizationMutation()

  const handleDelete = async () => {
    if (!organization) return
    try {
      await deleteOrganization.mutateAsync(organization.id)
      onClose()
      notifications.show({
        title: 'Удалено',
        message: `Организация "${organization.name}" удалена`,
        color: 'green',
      })
    } catch {
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось удалить организацию. Возможно, есть активные воркспейсы.',
        color: 'red',
      })
    }
  }

  return (
    <Modal
      opened={!!organization}
      onClose={onClose}
      title="Удалить организацию"
      centered
    >
      <Stack>
        <Text size="sm">
          Вы уверены, что хотите удалить организацию <strong>{organization?.name}</strong>?
          Это действие нельзя отменить.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button
            color="red"
            onClick={handleDelete}
            loading={deleteOrganization.isPending}
          >
            Удалить
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
