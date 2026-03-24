'use client'

import {
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
  IconEye,
  IconThumbUp,
  IconMessageCircle,
} from '@tabler/icons-react'

import {
  useDeleteContentMutation,
  useRetryContentMutation,
} from '@/api/hooks/useContent'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { extractYouTubeVideoId, formatDuration, formatNumber } from '@/lib/utils/youtube'
import { getSourceType, getSourceTypeInfo } from '@/lib/utils/source-type'
import type { ContentItemShortWithYouTube } from '@/api/types/content'

import styles from './ContentCard.module.css'

type ContentItemWithProcessingStep = ContentItemShortWithYouTube & {
  processing_step?: string | null
}

interface ContentCardProps {
  item: ContentItemWithProcessingStep
  workspaceId: number
  basePath: string
}

export function ContentCard({ item, workspaceId, basePath }: ContentCardProps) {
  const deleteContent = useDeleteContentMutation(workspaceId)
  const retryContent = useRetryContentMutation(workspaceId)

  const effectiveStatus = item.status

  const sourceType = getSourceType(item.source_type)
  const sourceInfo = getSourceTypeInfo(item.source_type)
  const isYoutube = sourceType === 'youtube_video'
  const videoId = isYoutube
    ? (item.video_id ?? extractYouTubeVideoId(item.url))
    : null
  const hasYouTubeMetrics = isYoutube && (
    item.views_count != null || item.likes_count != null || item.comments_count != null
  )

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

  const duration = formatDuration(item.duration)

  return (
    <Link href={`${basePath}/${item.id}`} className={styles.card}>
      {/* Thumbnail / source icon */}
      <div className={styles.thumbnailWrap}>
        {videoId ? (
          <Image
            src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
            alt={item.title ?? videoId}
            fill
            sizes="(max-width: 768px) 100vw, 340px"
            className={styles.thumbnail}
          />
        ) : (
          <div className={styles.sourceIconWrap}>
            {sourceInfo.icon(40)}
          </div>
        )}
        {duration && (
          <span className={styles.durationBadge}>{duration}</span>
        )}
      </div>

      {/* Body */}
      <div className={styles.cardBody}>
        <span className={styles.title}>
          {item.title ?? item.url}
        </span>

        <div className={styles.meta}>
          <span className={styles.metaText}>{sourceInfo.label}</span>
          <span className={styles.metaText}>
            {new Date(item.created_at).toLocaleDateString('ru-RU')}
          </span>
          {item.channel_title && (
            <span className={styles.metaText}>{item.channel_title}</span>
          )}
        </div>

        {hasYouTubeMetrics && (
          <div className={styles.metricRow}>
            {item.views_count != null && (
              <span className={styles.metric}>
                <IconEye size={14} />
                {formatNumber(item.views_count)}
              </span>
            )}
            {item.likes_count != null && (
              <span className={styles.metric}>
                <IconThumbUp size={14} />
                {formatNumber(item.likes_count)}
              </span>
            )}
            {item.comments_count != null && (
              <span className={styles.metric}>
                <IconMessageCircle size={14} />
                {formatNumber(item.comments_count)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={styles.cardFooter}>
        <StatusBadge status={effectiveStatus} />

        <div className={styles.actions}>
          {item.status.toLowerCase() === 'failed' && (
            <Tooltip label="Повторить">
              <ActionIcon
                variant="subtle"
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
              variant="subtle"
              color="red"
              size="sm"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteConfirm() }}
              loading={deleteContent.isPending}
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>
    </Link>
  )
}
