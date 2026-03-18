'use client'

import {
  Card,
  Group,
  Stack,
  Text,
  Badge,
  ActionIcon,
  Avatar,
  ThemeIcon,
  Tooltip,
} from '@mantine/core'
import {
  IconBrandYoutube,
  IconBrandTelegram,
  IconBrandInstagram,
  IconMessage,
  IconRefresh,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useRouter } from 'next/navigation'

import { useSyncCompetitorMutation } from '@/api/hooks/useCompetitors'
import type { CompetitorChannel, CompetitorPlatform, CompetitorChannelStatus } from '@/api/types/competitor'

interface ChannelCardProps {
  channel: CompetitorChannel
  workspaceId: number
}

const platformConfig: Record<CompetitorPlatform, { icon: typeof IconBrandYoutube; label: string; color: string }> = {
  youtube: { icon: IconBrandYoutube, label: 'YouTube', color: 'red' },
  telegram: { icon: IconBrandTelegram, label: 'Telegram', color: 'blue' },
  instagram: { icon: IconBrandInstagram, label: 'Instagram', color: 'grape' },
  vk: { icon: IconMessage, label: 'VK', color: 'indigo' },
}

const statusConfig: Record<CompetitorChannelStatus, { label: string; color: string }> = {
  active: { label: 'Активен', color: 'green' },
  paused: { label: 'Пауза', color: 'yellow' },
  error: { label: 'Ошибка', color: 'red' },
  archived: { label: 'Архив', color: 'gray' },
}

function formatLastSync(date?: string): string {
  if (!date) return 'Не синхронизирован'
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffHours < 1) return 'Менее часа назад'
  if (diffHours < 24) return `${diffHours} ч. назад`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Вчера'
  return `${diffDays} дн. назад`
}

export function ChannelCard({ channel, workspaceId }: ChannelCardProps) {
  const router = useRouter()
  const syncMutation = useSyncCompetitorMutation()
  const platform = platformConfig[channel.platform]
  const status = statusConfig[channel.status]
  const PlatformIcon = platform.icon

  async function handleSync(e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await syncMutation.mutateAsync(channel.id)
      notifications.show({
        title: 'Синхронизация запущена',
        message: `Обновление данных канала "${channel.display_name ?? channel.handle}"`,
        color: 'blue',
      })
    } catch {
      notifications.show({
        title: 'Ошибка синхронизации',
        message: 'Не удалось запустить синхронизацию',
        color: 'red',
      })
    }
  }

  function handleClick() {
    router.push(`/workspaces/${workspaceId}/competitors/${channel.id}`)
  }

  return (
    <Card
      withBorder
      padding="lg"
      radius="md"
      onClick={handleClick}
      style={{ cursor: 'pointer' }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="md" wrap="nowrap" style={{ minWidth: 0 }}>
          {channel.avatar_url ? (
            <Avatar src={channel.avatar_url} size={48} radius="xl" />
          ) : (
            <ThemeIcon size={48} radius="xl" variant="light" color={platform.color}>
              <PlatformIcon size={24} />
            </ThemeIcon>
          )}

          <Stack gap={4} style={{ minWidth: 0 }}>
            <Group gap="xs" wrap="nowrap">
              <Text fw={600} truncate>
                {channel.display_name ?? channel.handle ?? 'Без названия'}
              </Text>
              <ThemeIcon size="xs" variant="transparent" color={platform.color}>
                <PlatformIcon size={14} />
              </ThemeIcon>
            </Group>

            <Group gap="xs">
              <Badge size="xs" variant="light" color={status.color}>
                {status.label}
              </Badge>
              <Text size="xs" c="dimmed">
                {formatLastSync(channel.last_parsed_at)}
              </Text>
            </Group>

            {channel.subscribers_count != null && (
              <Text size="xs" c="dimmed">
                {channel.subscribers_count.toLocaleString('ru-RU')} подписчиков
                {channel.posts_count != null && ` · ${channel.posts_count} публикаций`}
              </Text>
            )}
          </Stack>
        </Group>

        <Tooltip label="Синхронизировать">
          <ActionIcon
            variant="light"
            size="lg"
            onClick={handleSync}
            loading={syncMutation.isPending}
          >
            <IconRefresh size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Card>
  )
}
