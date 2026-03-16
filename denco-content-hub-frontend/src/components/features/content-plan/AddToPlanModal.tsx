'use client'

import { useEffect, useMemo } from 'react'
import {
  Modal,
  Button,
  Group,
  Select,
  Stack,
  Textarea,
} from '@mantine/core'
import { DateTimePicker } from '@mantine/dates'
import { useForm } from '@mantine/form'
import { zodResolver } from 'mantine-form-zod-resolver'
import { notifications } from '@mantine/notifications'

import { useLibraryItemsQuery } from '@/api/hooks/useLibrary'
import { useCreateContentPlanItemMutation } from '@/api/hooks/useContentPlan'
import { useMembersQuery } from '@/api/hooks/useTeam'
import {
  addToPlanSchema,
  type AddToPlanFormValues,
} from '@/lib/validations/content-plan'

interface PreselectedItem {
  id: number
  label: string
}

interface AddToPlanModalProps {
  opened: boolean
  onClose: () => void
  workspaceId: number
  initialDate?: Date | null
  preselectedItem?: PreselectedItem | null
}

export function AddToPlanModal({
  opened,
  onClose,
  workspaceId,
  initialDate,
  preselectedItem,
}: AddToPlanModalProps) {
  const createItem = useCreateContentPlanItemMutation(workspaceId)

  const { data: libraryData } = useLibraryItemsQuery(workspaceId, {
    size: 100,
    status: 'ready',
  })

  const { data: draftLibraryData } = useLibraryItemsQuery(workspaceId, {
    size: 100,
    status: 'draft',
  })

  const { data: membersData } = useMembersQuery(workspaceId)

  const libraryOptions = useMemo(() => {
    const readyItems = libraryData?.items ?? []
    const draftItems = draftLibraryData?.items ?? []
    const all = [...readyItems, ...draftItems]

    return all.map((item) => ({
      value: String(item.id),
      label: item.title ?? `#${item.id} (${item.platform})`,
    }))
  }, [libraryData?.items, draftLibraryData?.items])

  const memberOptions = useMemo(() => {
    const members = membersData?.items ?? []
    return members.map((m) => ({
      value: String(m.user_id),
      label: m.user_name || m.user_email,
    }))
  }, [membersData?.items])

  const form = useForm<AddToPlanFormValues>({
    mode: 'uncontrolled',
    initialValues: {
      library_item_id: 0,
      scheduled_at: initialDate ?? new Date(),
      assignee_id: null,
      notes: '',
    },
    validate: zodResolver(addToPlanSchema),
  })

  useEffect(() => {
    if (opened) {
      if (initialDate) {
        form.setFieldValue('scheduled_at', initialDate)
      }
      if (preselectedItem) {
        form.setFieldValue('library_item_id', preselectedItem.id)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, initialDate, preselectedItem])

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await createItem.mutateAsync({
        library_item_id: values.library_item_id,
        scheduled_at: values.scheduled_at.toISOString(),
        assignee_id: values.assignee_id ?? undefined,
        notes: values.notes || undefined,
      })
      form.reset()
      onClose()
      notifications.show({
        title: 'Добавлено в план',
        message: 'Контент успешно добавлен в контент-план',
        color: 'green',
      })
    } catch {
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось добавить в контент-план',
        color: 'red',
      })
    }
  })

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Добавить в контент-план"
      centered
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <Select
            label="Контент из библиотеки"
            placeholder="Выберите контент"
            data={
              preselectedItem
                ? [{ value: String(preselectedItem.id), label: preselectedItem.label }]
                : libraryOptions
            }
            searchable
            disabled={!!preselectedItem}
            key={form.key('library_item_id')}
            value={
              form.getValues().library_item_id
                ? String(form.getValues().library_item_id)
                : null
            }
            onChange={(val) =>
              form.setFieldValue('library_item_id', val ? Number(val) : 0)
            }
            error={form.errors.library_item_id}
          />

          <DateTimePicker
            label="Дата и время публикации"
            placeholder="Выберите дату и время"
            valueFormat="DD.MM.YYYY HH:mm"
            key={form.key('scheduled_at')}
            {...form.getInputProps('scheduled_at')}
          />

          <Select
            label="Ответственный"
            placeholder="Не назначен"
            data={memberOptions}
            clearable
            value={
              form.getValues().assignee_id
                ? String(form.getValues().assignee_id)
                : null
            }
            onChange={(val) =>
              form.setFieldValue('assignee_id', val ? Number(val) : null)
            }
          />

          <Textarea
            label="Заметки"
            placeholder="Комментарий к публикации (необязательно)"
            autosize
            minRows={2}
            maxRows={4}
            key={form.key('notes')}
            {...form.getInputProps('notes')}
          />

          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" loading={createItem.isPending}>
              Добавить в план
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
