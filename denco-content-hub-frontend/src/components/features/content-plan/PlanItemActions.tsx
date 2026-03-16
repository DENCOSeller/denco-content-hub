'use client'

import { ActionIcon, Group, Tooltip } from '@mantine/core'
import {
  IconSend,
  IconX,
  IconChartBar,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'

import {
  usePublishContentPlanItemMutation,
  useUpdateContentPlanItemMutation,
} from '@/api/hooks/useContentPlan'
import type { ContentPlanItemResponse } from '@/api/client/types.gen'

interface PlanItemActionsProps {
  item: ContentPlanItemResponse
  workspaceId: number
  onMetricsClick: () => void
}

export function PlanItemActions({
  item,
  workspaceId,
  onMetricsClick,
}: PlanItemActionsProps) {
  const publishMutation = usePublishContentPlanItemMutation(workspaceId)
  const updateMutation = useUpdateContentPlanItemMutation(workspaceId)

  const handlePublish = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      await publishMutation.mutateAsync(item.id)
      notifications.show({
        title: 'Опубликовано',
        message: 'Контент успешно опубликован',
        color: 'green',
      })
    } catch {
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось опубликовать',
        color: 'red',
      })
    }
  }

  const handleCancel = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      await updateMutation.mutateAsync({
        itemId: item.id,
        data: { status: 'cancelled' } as never,
      })
      notifications.show({
        title: 'Отменено',
        message: 'Публикация отменена',
        color: 'yellow',
      })
    } catch {
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось отменить',
        color: 'red',
      })
    }
  }

  const handleMetrics = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onMetricsClick()
  }

  return (
    <Group gap={2} wrap="nowrap" onClick={(e) => e.stopPropagation()}>
      {item.status === 'scheduled' && (
        <>
          <Tooltip label="Опубликовать" openDelay={300}>
            <ActionIcon
              variant="subtle"
              color="green"
              size="xs"
              loading={publishMutation.isPending}
              onClick={handlePublish}
            >
              <IconSend size={12} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="Отменить" openDelay={300}>
            <ActionIcon
              variant="subtle"
              color="red"
              size="xs"
              loading={updateMutation.isPending}
              onClick={handleCancel}
            >
              <IconX size={12} />
            </ActionIcon>
          </Tooltip>
        </>
      )}

      {item.status === 'published' && (
        <Tooltip label="Метрики" openDelay={300}>
          <ActionIcon
            variant="subtle"
            color="blue"
            size="xs"
            onClick={handleMetrics}
          >
            <IconChartBar size={12} />
          </ActionIcon>
        </Tooltip>
      )}
    </Group>
  )
}
