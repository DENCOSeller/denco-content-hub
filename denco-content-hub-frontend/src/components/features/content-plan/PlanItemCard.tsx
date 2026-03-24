'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Box, Checkbox, Group, Text, Tooltip } from '@mantine/core'
import {
  IconBrandYoutube,
  IconBrandInstagram,
  IconBrandTelegram,
  IconBrandVk,
  IconWorld,
} from '@tabler/icons-react'

import type { ContentPlanItemResponse } from '@/api/client/types.gen'

import { PlanItemActions } from './PlanItemActions'
import { MetricsModal } from './MetricsModal'
import styles from './plan-item-card.module.css'

const STATUS_COLOR: Record<string, string> = {
  draft: 'var(--text-tertiary)',
  scheduled: 'var(--eco-content)',
  published: '#22c55e',
  cancelled: 'var(--color-error)',
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Черновик',
  scheduled: 'Запланирован',
  published: 'Опубликован',
  cancelled: 'Отменён',
}

const PLATFORM_ICON: Record<string, React.ComponentType<{ size?: number; stroke?: number }>> = {
  youtube: IconBrandYoutube,
  instagram: IconBrandInstagram,
  telegram: IconBrandTelegram,
  vk: IconBrandVk,
}

const PLATFORM_LABEL: Record<string, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  telegram: 'Telegram',
  vk: 'ВКонтакте',
}

interface PlanItemCardProps {
  item: ContentPlanItemResponse
  workspaceId: number
  variant?: 'compact' | 'expanded'
  isDragging?: boolean
  selectable?: boolean
  selected?: boolean
  onSelect?: (id: number) => void
}

export function PlanItemCard({
  item,
  workspaceId,
  variant = 'compact',
  isDragging,
  selectable,
  selected,
  onSelect,
}: PlanItemCardProps) {
    const [metricsOpened, setMetricsOpened] = useState(false)

    const statusColor = STATUS_COLOR[item.status] ?? 'var(--text-tertiary)'
    const PlatformIcon = PLATFORM_ICON[item.platform] ?? IconWorld
    const platformLabel = PLATFORM_LABEL[item.platform] ?? item.platform

    const title = item.library_item_title ?? 'Без названия'
    const time = item.scheduled_at
      ? new Date(item.scheduled_at).toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : null

    const libraryHref = `/workspaces/${workspaceId}/library/${item.library_item_id}`
    const isCancelled = item.status === 'cancelled'

    const handleCheckboxChange = (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      onSelect?.(item.id)
    }

    return (
      <>
        <Tooltip
          label={`${title} — ${STATUS_LABEL[item.status] ?? item.status}`}
          openDelay={400}
        >
          <Box
            component={Link}
            href={libraryHref}
            className={styles.card}
            data-variant={variant}
            data-dragging={isDragging || undefined}
            data-cancelled={isCancelled || undefined}
            data-selected={selected || undefined}
            style={{ '--status-color': statusColor } as React.CSSProperties}
          >
            <Group gap={6} wrap="nowrap" w="100%">
              {selectable && (
                <Box
                  className={styles.checkboxWrapper}
                  onClick={handleCheckboxChange}
                >
                  <Checkbox
                    size="xs"
                    checked={selected ?? false}
                    onChange={() => {}}
                    tabIndex={-1}
                    styles={{ input: { cursor: 'pointer' } }}
                  />
                </Box>
              )}

              <Tooltip label={platformLabel} openDelay={300}>
                <Box className={styles.platformIcon}>
                  <PlatformIcon size={variant === 'compact' ? 12 : 14} stroke={1.5} />
                </Box>
              </Tooltip>

              {time && (
                <Text size="10px" c="dimmed" className={styles.time}>
                  {time}
                </Text>
              )}

              <Text size="xs" className={styles.title} flex={1}>
                {title}
              </Text>

              {variant === 'expanded' && item.notes && (
                <Text size="10px" c="dimmed" className={styles.notes} lineClamp={1}>
                  {item.notes}
                </Text>
              )}

              <PlanItemActions
                item={item}
                workspaceId={workspaceId}
                onMetricsClick={() => setMetricsOpened(true)}
              />
            </Group>
          </Box>
        </Tooltip>

        <MetricsModal
          opened={metricsOpened}
          onClose={() => setMetricsOpened(false)}
          workspaceId={workspaceId}
          item={item}
        />
      </>
    )
}
