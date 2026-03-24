'use client'

import { useEffect } from 'react'
import {
  Modal,
  Stack,
  TextInput,
  Group,
  Button,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { zodResolver } from 'mantine-form-zod-resolver'
import { notifications } from '@mantine/notifications'
import { z } from 'zod'

import { useUpdateOrganizationMutation } from '@/api/hooks/useOrganizations'
import type { OrganizationResponse } from '@/api/client/types.gen'

const organizationNameSchema = z.object({
  name: z.string().min(1, 'Название обязательно').max(255, 'Максимум 255 символов'),
})

type OrganizationFormValues = z.infer<typeof organizationNameSchema>

interface EditOrganizationModalProps {
  organization: OrganizationResponse | null
  onClose: () => void
}

export function EditOrganizationModal({ organization, onClose }: EditOrganizationModalProps) {
  const updateOrganization = useUpdateOrganizationMutation()

  const form = useForm<OrganizationFormValues>({
    mode: 'uncontrolled',
    initialValues: { name: organization?.name ?? '' },
    validate: zodResolver(organizationNameSchema),
  })

  useEffect(() => {
    if (organization) {
      form.setValues({ name: organization.name })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization])

  const handleSubmit = form.onSubmit(async (values) => {
    if (!organization) return
    try {
      await updateOrganization.mutateAsync({
        organizationId: organization.id,
        data: { name: values.name },
      })
      onClose()
      notifications.show({
        title: 'Обновлено',
        message: `Организация переименована в "${values.name}"`,
        color: 'green',
      })
    } catch {
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось обновить организацию',
        color: 'red',
      })
    }
  })

  return (
    <Modal
      opened={!!organization}
      onClose={onClose}
      title="Редактировать организацию"
      centered
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="Название"
            placeholder="Название организации"
            key={form.key('name')}
            {...form.getInputProps('name')}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" loading={updateOrganization.isPending}>
              Сохранить
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
