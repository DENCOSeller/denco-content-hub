'use client'

import {
  Card,
  Group,
  Stack,
  Text,
  Badge,
  Switch,
  ActionIcon,
} from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import {
  IconBrandYoutube,
  IconBrandInstagram,
  IconPencil,
  IconTrash,
  IconClock,
} from '@tabler/icons-react'

import type { TrendNiche, TrendPlatform } from '@/api/types/trend'
import { useUpdateTrendNicheMutation, useDeleteTrendNicheMutation } from '@/api/hooks/useTrends'

import styles from './NicheCard.module.css'

interface NicheCardProps {
  niche: TrendNiche
  workspaceId: number
  onEdit: (niche: TrendNiche) => void
}

const PLATFORM_ICON: Record<TrendPlatform, typeof IconBrandYoutube> = {
  youtube: IconBrandYoutube,
  instagram: IconBrandInstagram,
}

const PLATFORM_COLOR: Record<TrendPlatform, string> = {
  youtube: 'red',
  instagram: 'grape',
}

export function NicheCard({ niche, workspaceId, onEdit }: NicheCardProps) {
  const updateNiche = useUpdateTrendNicheMutation(workspaceId)
  const deleteNiche = useDeleteTrendNicheMutation(workspaceId)

  function handleToggleActive() {
    updateNiche.mutate(
      { nicheId: niche.id, data: { is_active: !niche.is_active } },
      {
        onError: () => {
          notifications.show({
            title: 'Ошибка',
            message: 'Не удалось обновить статус ниши',
            color: 'red',
          })
        },
      },
    )
  }

  function handleDelete() {
    modals.openConfirmModal({
      title: 'Удалить нишу',
      children: (
        <Text size="sm">
          Вы уверены, что хотите удалить нишу «{niche.name}»? Это действие нельзя отменить.
        </Text>
      ),
      labels: { confirm: 'Удалить', cancel: 'Отмена' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        deleteNiche.mutate(niche.id, {
          onSuccess: () => {
            notifications.show({
              title: 'Удалено',
              message: `Ниша «${niche.name}» удалена`,
              color: 'green',
            })
          },
          onError: () => {
            notifications.show({
              title: 'Ошибка',
              message: 'Не удалось удалить нишу',
              color: 'red',
            })
          },
        })
      },
    })
  }

  return (
    <Card padding="lg" radius="md" className={styles.card}>
      <Stack gap="sm">
        <div className={styles.header}>
          <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <Text fw={600} size="md" c="gray.1" truncate="end">
              {niche.name}
            </Text>
            <Switch
              size="xs"
              checked={niche.is_active}
              onChange={handleToggleActive}
              disabled={updateNiche.isPending}
            />
          </Group>
          <div className={styles.actions}>
            <ActionIcon variant="subtle" size="sm" onClick={() => onEdit(niche)}>
              <IconPencil size={14} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              size="sm"
              color="red"
              onClick={handleDelete}
              loading={deleteNiche.isPending}
            >
              <IconTrash size={14} />
            </ActionIcon>
          </div>
        </div>

        <Group gap={4} wrap="wrap">
          {niche.platforms.map((p) => {
            const Icon = PLATFORM_ICON[p]
            return (
              <Badge
                key={p}
                size="sm"
                variant="light"
                color={PLATFORM_COLOR[p]}
                leftSection={<Icon size={12} />}
              >
                {p === 'youtube' ? 'YouTube' : 'Instagram'}
              </Badge>
            )
          })}
        </Group>

        <Group gap={4} wrap="wrap">
          {niche.keywords.map((kw) => (
            <Badge key={kw} size="xs" variant="dot" color="blue">
              {kw}
            </Badge>
          ))}
        </Group>

        <Group gap="xs">
          <IconClock size={14} style={{ color: 'var(--mantine-color-dimmed)' }} />
          <Text size="xs" c="dimmed">
            Каждые {niche.monitoring_interval_hours} ч.
          </Text>
        </Group>
      </Stack>
    </Card>
  )
}
