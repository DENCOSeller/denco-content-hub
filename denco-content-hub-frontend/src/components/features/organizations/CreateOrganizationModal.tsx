'use client'

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

import { useCreateOrganizationMutation } from '@/api/hooks/useOrganizations'

const organizationNameSchema = z.object({
  name: z.string().min(1, 'Название обязательно').max(255, 'Максимум 255 символов'),
})

type OrganizationFormValues = z.infer<typeof organizationNameSchema>

interface CreateOrganizationModalProps {
  opened: boolean
  onClose: () => void
}

export function CreateOrganizationModal({ opened, onClose }: CreateOrganizationModalProps) {
  const createOrganization = useCreateOrganizationMutation()

  const form = useForm<OrganizationFormValues>({
    mode: 'uncontrolled',
    initialValues: { name: '' },
    validate: zodResolver(organizationNameSchema),
  })

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await createOrganization.mutateAsync(values)
      form.reset()
      onClose()
      notifications.show({
        title: 'Организация создана',
        message: `Организация "${values.name}" успешно создана`,
        color: 'green',
      })
    } catch {
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось создать организацию',
        color: 'red',
      })
    }
  })

  return (
    <Modal opened={opened} onClose={onClose} title="Новая организация" centered>
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
            <Button type="submit" loading={createOrganization.isPending}>
              Создать
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
