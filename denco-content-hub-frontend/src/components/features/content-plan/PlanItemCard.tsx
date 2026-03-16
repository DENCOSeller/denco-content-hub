'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Box, Group, Text, Tooltip } from '@mantine/core'

import type { ContentPlanItemResponse } from '@/api/client/types.gen'

import { PlanItemActions } from './PlanItemActions'
import { MetricsModal } from './MetricsModal'
import styles from './plan-item-card.module.css'

const PLATFORM_COLOR: Record<string, string> = {
  youtube: '#FF0000',
  instagram: '#E1306C',
  telegram: '#0088CC',
  vk: '#4680C2',
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'var(--mantine-color-gray-5)',
  scheduled: 'var(--mantine-color-blue-5)',
  published: 'var(--mantine-color-green-5)',
  cancelled: 'var(--mantine-color-red-5)',
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Черновик',
  scheduled: 'Запланирован',
  published: 'Опубликован',
  cancelled: 'Отменён',
}

interface PlanItemCardProps {
  item: ContentPlanItemResponse
  workspaceId: number
}

export function PlanItemCard({ item, workspaceId }: PlanItemCardProps) {
  const [metricsOpened, setMetricsOpened] = useState(false)

  const platformColor =
    PLATFORM_COLOR[item.platform] ?? 'var(--mantine-color-gray-5)'

  const title = item.library_item_title ?? 'Без названия'
  const time = item.scheduled_at
    ? new Date(item.scheduled_at).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  const libraryHref = `/workspaces/${workspaceId}/library/${item.library_item_id}`

  return (
    <>
      <Tooltip label={`${title} — ${STATUS_LABEL[item.status] ?? item.status}`} openDelay={400}>
        <Box
          component={Link}
          href={libraryHref}
          className={styles.card}
          style={{
            textDecoration: 'none',
            color: 'inherit',
            '--platform-color': platformColor,
          } as React.CSSProperties}
        >
          <Group gap={6} wrap="nowrap" w="100%">
            {time && (
              <Text size="10px" c="dimmed" className={styles.time}>
                {time}
              </Text>
            )}

            <Text size="xs" className={styles.title} flex={1}>
              {title}
            </Text>

            <PlanItemActions
              item={item}
              workspaceId={workspaceId}
              onMetricsClick={() => setMetricsOpened(true)}
            />

            <Box
              className={styles.statusDot}
              style={{ backgroundColor: STATUS_COLOR[item.status] }}
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
