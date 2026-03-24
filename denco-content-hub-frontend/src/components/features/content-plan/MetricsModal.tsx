'use client'

import { useEffect } from 'react'
import {
  Modal,
  Button,
  Group,
  NumberInput,
  Text,
  Badge,
  Box,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { zodResolver } from 'mantine-form-zod-resolver'
import { notifications } from '@mantine/notifications'
import {
  IconEye,
  IconUsers,
  IconHeart,
  IconMessageCircle,
  IconBrandYoutube,
  IconBrandInstagram,
  IconBrandTelegram,
  IconBrandVk,
  IconWorld,
} from '@tabler/icons-react'

import { useUpdateContentPlanMetricsMutation } from '@/api/hooks/useContentPlan'
import {
  metricsSchema,
  type MetricsFormValues,
} from '@/lib/validations/content-plan'
import type { ContentPlanItemResponse } from '@/api/client/types.gen'

import styles from './metrics-modal.module.css'

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

function formatThousands(n: number): string {
  return n.toLocaleString('ru-RU')
}

const METRICS_CONFIG = [
  { key: 'views' as const, label: 'Просмотры', icon: IconEye, placeholder: formatThousands(10000) },
  { key: 'reach' as const, label: 'Охват', icon: IconUsers, placeholder: formatThousands(5000) },
  { key: 'likes' as const, label: 'Лайки', icon: IconHeart, placeholder: formatThousands(500) },
  { key: 'comments' as const, label: 'Комментарии', icon: IconMessageCircle, placeholder: formatThousands(50) },
] as const

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

  const PlatformIcon = item ? (PLATFORM_ICON[item.platform] ?? IconWorld) : IconWorld
  const platformLabel = item ? (PLATFORM_LABEL[item.platform] ?? item.platform) : ''
  const statusColor = item ? (STATUS_COLOR[item.status] ?? 'var(--text-tertiary)') : 'var(--text-tertiary)'
  const statusLabel = item ? (STATUS_LABEL[item.status] ?? item.status) : ''
  const title = item?.library_item_title ?? 'Без названия'

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Метрики публикации"
      centered
      size="md"
    >
      <form onSubmit={handleSubmit}>
        {item && (
          <Box
            className={styles.header}
            style={{ '--status-color': statusColor } as React.CSSProperties}
          >
            <Text className={styles.headerTitle}>{title}</Text>
            <div className={styles.headerMeta}>
              <Group gap={4} wrap="nowrap">
                <PlatformIcon size={14} stroke={1.5} />
                <Text size="xs" c="dimmed">{platformLabel}</Text>
              </Group>
              <Group gap={4} wrap="nowrap">
                <span className={styles.statusDot} />
                <Badge size="xs" variant="light" color="gray">{statusLabel}</Badge>
              </Group>
            </div>
          </Box>
        )}

        <div className={styles.metricsGrid}>
          {METRICS_CONFIG.map(({ key, label, icon: Icon, placeholder }) => (
            <div key={key} className={styles.metricField}>
              <div className={styles.metricLabel}>
                <span className={styles.metricIcon}>
                  <Icon size={14} stroke={1.5} />
                </span>
                {label}
              </div>
              <NumberInput
                placeholder={placeholder}
                min={0}
                allowNegative={false}
                thousandSeparator=" "
                classNames={{ input: styles.metricInput }}
                key={form.key(key)}
                {...form.getInputProps(key)}
              />
            </div>
          ))}
        </div>

        <div className={styles.actions}>
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={updateMetrics.isPending}>
            Сохранить
          </Button>
        </div>
      </form>
    </Modal>
  )
}
