'use client'

import { useEffect } from 'react'
import {
  Modal,
  Button,
  Group,
  NumberInput,
  Stack,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { zodResolver } from 'mantine-form-zod-resolver'
import { notifications } from '@mantine/notifications'

import { useUpdateContentPlanMetricsMutation } from '@/api/hooks/useContentPlan'
import {
  metricsSchema,
  type MetricsFormValues,
} from '@/lib/validations/content-plan'
import type { ContentPlanItemResponse } from '@/api/client/types.gen'

interface MetricsModalProps {
  opened: boolean
  onClose: () => void
  workspaceId: number
  item: ContentPlanItemResponse | null
}

export function MetricsModal({
  opened,
  onClose,
  workspaceId,
  item,
}: MetricsModalProps) {
  const updateMetrics = useUpdateContentPlanMetricsMutation(workspaceId)

  const form = useForm<MetricsFormValues>({
    mode: 'uncontrolled',
    initialValues: {
      views: null,
      reach: null,
      likes: null,
      comments: null,
    },
    validate: zodResolver(metricsSchema),
  })

  useEffect(() => {
    if (opened && item) {
      const m = item.metrics as Record<string, number | null> | undefined
      form.setValues({
        views: m?.views ?? null,
        reach: m?.reach ?? null,
        likes: m?.likes ?? null,
        comments: m?.comments ?? null,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, item])

  const handleSubmit = form.onSubmit(async (values) => {
    if (!item) return

    try {
      await updateMetrics.mutateAsync({
        itemId: item.id,
        data: {
          views: values.views ?? undefined,
          reach: values.reach ?? undefined,
          likes: values.likes ?? undefined,
          comments: values.comments ?? undefined,
        },
      })
      onClose()
      notifications.show({
        title: 'Метрики сохранены',
        message: 'Метрики публикации обновлены',
        color: 'green',
      })
    } catch {
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось сохранить метрики',
        color: 'red',
      })
    }
  })

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Метрики публикации"
      centered
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <NumberInput
            label="Просмотры"
            placeholder="0"
            min={0}
            allowNegative={false}
            key={form.key('views')}
            {...form.getInputProps('views')}
          />

          <NumberInput
            label="Охват"
            placeholder="0"
            min={0}
            allowNegative={false}
            key={form.key('reach')}
            {...form.getInputProps('reach')}
          />

          <NumberInput
            label="Лайки"
            placeholder="0"
            min={0}
            allowNegative={false}
            key={form.key('likes')}
            {...form.getInputProps('likes')}
          />

          <NumberInput
            label="Комментарии"
            placeholder="0"
            min={0}
            allowNegative={false}
            key={form.key('comments')}
            {...form.getInputProps('comments')}
          />

          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" loading={updateMetrics.isPending}>
              Сохранить
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
