'use client'

import {
  Card,
  Group,
  Stack,
  Text,
  Badge,
  ActionIcon,
  Tooltip,
} from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import Link from 'next/link'
import {
  IconTrash,
  IconBrandYoutube,
  IconBrandInstagram,
  IconBrandTelegram,
  IconWorld,
} from '@tabler/icons-react'

import { useDeleteLibraryItemMutation } from '@/api/hooks/useLibrary'
import type { LibraryItemResponse } from '@/api/client/types.gen'

import styles from './LibraryItemCard.module.css'

interface LibraryItemCardProps {
  item: LibraryItemResponse
  workspaceId: number
}

const PLATFORM_CONFIG: Record<string, { icon: typeof IconBrandYoutube; color: string; label: string }> = {
  youtube: { icon: IconBrandYoutube, color: '#FF0000', label: 'YouTube' },
  instagram: { icon: IconBrandInstagram, color: '#E1306C', label: 'Instagram' },
  telegram: { icon: IconBrandTelegram, color: '#0088cc', label: 'Telegram' },
  vk: { icon: IconWorld, color: '#4C75A3', label: 'ВКонтакте' },
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  shorts: 'Shorts',
  long_video: 'Длинное видео',
  reels: 'Reels',
  post: 'Пост',
  carousel: 'Карусель',
  article: 'Статья',
  clip: 'Клип',
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  reach: { label: 'Охват', color: 'blue' },
  expert: { label: 'Экспертный', color: 'violet' },
  selling: { label: 'Продающий', color: 'green' },
  warming: { label: 'Прогрев', color: 'orange' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Черновик', color: 'gray' },
  ready: { label: 'Готов', color: 'green' },
  published: { label: 'Опубликован', color: 'blue' },
}

export function LibraryItemCard({ item, workspaceId }: LibraryItemCardProps) {
  const deleteItem = useDeleteLibraryItemMutation(workspaceId)
  const basePath = `/workspaces/${workspaceId}/library`

  const platform = PLATFORM_CONFIG[item.platform] ?? PLATFORM_CONFIG.vk
  const PlatformIcon = platform.icon
  const contentTypeLabel = CONTENT_TYPE_LABELS[item.content_type] ?? item.content_type
  const category = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.reach
  const status = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.draft

  const handleDelete = () => {
    deleteItem.mutate(item.id, {
      onSuccess: () => {
        notifications.show({ title: 'Удалено', message: 'Элемент удалён', color: 'green' })
      },
      onError: () => {
        notifications.show({ title: 'Ошибка', message: 'Не удалось удалить', color: 'red' })
      },
    })
  }

  const handleDeleteConfirm = () => {
    modals.openConfirmModal({
      title: 'Удалить элемент?',
      centered: true,
      children: (
        <Text size="sm">
          Вы уверены, что хотите удалить &quot;{item.title ?? 'Без названия'}&quot;?
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
      className={styles.card}
      style={{ cursor: 'pointer', textDecoration: 'none' }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <div className={styles.platformIcon} style={{ background: `${platform.color}20` }}>
            <PlatformIcon size={22} style={{ color: platform.color }} />
          </div>
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Text fw={500} c="gray.1" truncate="end">
              {item.title ?? 'Без названия'}
            </Text>
            <Group gap="xs">
              <Text size="xs" c="dimmed">{platform.label}</Text>
              <Text size="xs" c="dimmed">·</Text>
              <Text size="xs" c="dimmed">{contentTypeLabel}</Text>
              <Text size="xs" c="dimmed">·</Text>
              <Text size="xs" c="dimmed">
                {new Date(item.created_at).toLocaleDateString('ru-RU')}
              </Text>
            </Group>
          </Stack>
        </Group>

        <Group gap="xs" wrap="nowrap">
          <Badge variant="light" color={category.color} size="sm">{category.label}</Badge>
          <Badge variant="light" color={status.color} size="sm">{status.label}</Badge>
          <Badge variant="outline" color="gray" size="sm">Hunt {item.hunt_level}</Badge>

          <Tooltip label="Удалить">
            <ActionIcon
              variant="light"
              color="red"
              size="sm"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteConfirm() }}
              loading={deleteItem.isPending}
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Card>
  )
}
