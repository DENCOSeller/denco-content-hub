'use client'

import {
  Card,
  Group,
  Stack,
  Text,
  ActionIcon,
  Tooltip,
} from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import Image from 'next/image'
import Link from 'next/link'
import {
  IconTrash,
  IconRefresh,
} from '@tabler/icons-react'

import {
  useDeleteContentMutation,
  useRetryContentMutation,
} from '@/api/hooks/useContent'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { extractYouTubeVideoId, formatDuration } from '@/lib/utils/youtube'
import { getSourceType, getSourceTypeInfo } from '@/lib/utils/source-type'
import type { ContentItemShortResponse } from '@/api/client/types.gen'

import styles from './ContentRow.module.css'

type ContentItemWithProcessingStep = ContentItemShortResponse & {
  processing_step?: string | null
}

interface ContentRowProps {
  item: ContentItemWithProcessingStep
  workspaceId: number
  basePath: string
}

export function ContentRow({ item, workspaceId, basePath }: ContentRowProps) {
  const deleteContent = useDeleteContentMutation(workspaceId)
  const retryContent = useRetryContentMutation(workspaceId)

  const effectiveStatus = item.status

  const sourceType = getSourceType(item.source_type)
  const sourceInfo = getSourceTypeInfo(item.source_type)
  const videoId = sourceType === 'youtube_video'
    ? (item.video_id ?? extractYouTubeVideoId(item.url))
    : null

  const handleDelete = () => {
    deleteContent.mutate(item.id, {
      onSuccess: () => {
        notifications.show({
          title: 'Удалено',
          message: 'Контент удалён',
          color: 'green',
        })
      },
      onError: () => {
        notifications.show({
          title: 'Ошибка',
          message: 'Не удалось удалить контент',
          color: 'red',
        })
      },
    })
  }

  const handleRetry = () => {
    retryContent.mutate(item.id, {
      onSuccess: () => {
        notifications.show({
          title: 'Повтор',
          message: 'Обработка запущена повторно',
          color: 'blue',
        })
      },
      onError: () => {
        notifications.show({
          title: 'Ошибка',
          message: 'Не удалось перезапустить обработку',
          color: 'red',
        })
      },
    })
  }

  const handleDeleteConfirm = () => {
    modals.openConfirmModal({
      title: 'Удалить референс?',
      centered: true,
      children: (
        <Text size="sm">
          Вы уверены, что хотите удалить &quot;{item.title ?? item.url}&quot;?
        </Text>
      ),
      labels: { confirm: 'Удалить', cancel: 'Отмена' },
      confirmProps: { color: 'red' },
      onConfirm: handleDelete,
    })
  }

  return (
    <Card
      component={Link}
      href={`${basePath}/${item.id}`}
      padding="md"
      radius="md"
      className={styles.contentCard}
      style={{ cursor: 'pointer', textDecoration: 'none' }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          {videoId ? (
            <Image
              src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
              alt={item.title ?? videoId}
              width={120}
              height={68}
              className={styles.thumbnail}
            />
          ) : (
            <div style={{ flexShrink: 0 }}>
              {sourceInfo.icon(24)}
            </div>
          )}
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Text fw={500} c="gray.1" truncate="end">
              {item.title ?? item.url}
            </Text>
            <Text size="xs" c="dimmed">
              {sourceInfo.label}
            </Text>
            <Group gap="xs">
              <Text size="xs" c="dimmed">
                {formatDuration(item.duration)}
              </Text>
              <Text size="xs" c="dimmed">
                {new Date(item.created_at).toLocaleDateString('ru-RU')}
              </Text>
            </Group>
          </Stack>
        </Group>

        <Group gap="xs" wrap="nowrap">
          <StatusBadge status={effectiveStatus} />

          {item.status.toLowerCase() === 'failed' && (
            <Tooltip label="Повторить">
              <ActionIcon
                variant="light"
                color="blue"
                size="sm"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRetry() }}
                loading={retryContent.isPending}
              >
                <IconRefresh size={14} />
              </ActionIcon>
            </Tooltip>
          )}

          <Tooltip label="Удалить">
            <ActionIcon
              variant="light"
              color="red"
              size="sm"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteConfirm() }}
              loading={deleteContent.isPending}
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Card>
  )
}
