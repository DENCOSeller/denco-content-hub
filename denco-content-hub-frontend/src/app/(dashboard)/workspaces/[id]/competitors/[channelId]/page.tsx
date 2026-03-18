'use client'

import { useState } from 'react'
import {
  Stack,
  Group,
  Text,
  Avatar,
  Badge,
  ThemeIcon,
  Card,
  Pagination,
  ActionIcon,
  Tooltip,
} from '@mantine/core'
import {
  IconArrowLeft,
  IconBrandYoutube,
  IconBrandTelegram,
  IconBrandInstagram,
  IconMessage,
  IconEye,
  IconThumbUp,
  IconMessageCircle,
  IconRefresh,
} from '@tabler/icons-react'
import { useParams, useRouter } from 'next/navigation'

import {
  useCompetitorDetailQuery,
  useCompetitorPostsQuery,
  useSyncCompetitorMutation,
} from '@/api/hooks/useCompetitors'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useSetAiPageContext } from '@/contexts/AiPageContext'
import { AppBreadcrumbs } from '@/components/shared/Breadcrumbs'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { EmptyState } from '@/components/shared/EmptyState'
import type { CompetitorPlatform, CompetitorPost } from '@/api/types/competitor'
import { PostCard } from '@/components/features/competitors/PostCard'
import { PostAnalysisPanel } from '@/components/features/competitors/PostAnalysisPanel'
import { notifications } from '@mantine/notifications'

const platformConfig: Record<CompetitorPlatform, { icon: typeof IconBrandYoutube; label: string; color: string }> = {
  youtube: { icon: IconBrandYoutube, label: 'YouTube', color: 'red' },
  telegram: { icon: IconBrandTelegram, label: 'Telegram', color: 'blue' },
  instagram: { icon: IconBrandInstagram, label: 'Instagram', color: 'grape' },
  vk: { icon: IconMessage, label: 'VK', color: 'indigo' },
}

export default function ChannelDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const workspaceId = Number(params.id)
  const channelId = Number(params.channelId)
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)

  const [page, setPage] = useState(1)
  const [selectedPost, setSelectedPost] = useState<CompetitorPost | null>(null)

  useSetAiPageContext({
    page_type: 'workspace',
    workspace_id: workspaceId,
    workspace_name: activeWorkspace?.name,
  })

  const { data: channel, isLoading, isError, refetch } = useCompetitorDetailQuery(channelId)
  const { data: postsData, isLoading: postsLoading } = useCompetitorPostsQuery(channelId, { page, size: 10 })
  const syncMutation = useSyncCompetitorMutation()

  if (isLoading) return <LoadingState message="Загрузка канала..." />
  if (isError || !channel) return <ErrorState onRetry={refetch} />

  const platform = platformConfig[channel.platform]
  const PlatformIcon = platform.icon

  const breadcrumbs = [
    { label: activeWorkspace?.company_name ?? '', href: '/' },
    { label: activeWorkspace?.name ?? '', href: `/workspaces/${workspaceId}` },
    { label: 'Мониторинг', href: `/workspaces/${workspaceId}/competitors` },
    { label: channel.display_name ?? channel.handle ?? 'Канал' },
  ]

  async function handleSync() {
    try {
      await syncMutation.mutateAsync(channelId)
      notifications.show({
        title: 'Синхронизация запущена',
        message: `Обновление данных канала "${channel!.display_name ?? channel!.handle}"`,
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

  return (
    <Stack>
      <AppBreadcrumbs items={breadcrumbs} />

      {/* Шапка канала */}
      <Card withBorder padding="lg" radius="md">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="md" wrap="nowrap">
            <ActionIcon variant="subtle" onClick={() => router.push(`/workspaces/${workspaceId}/competitors`)}>
              <IconArrowLeft size={18} />
            </ActionIcon>

            {channel.avatar_url ? (
              <Avatar src={channel.avatar_url} size={56} radius="xl" />
            ) : (
              <Avatar size={56} radius="xl" variant="gradient" gradient={{ from: platform.color, to: 'gray', deg: 135 }}>
                {(channel.display_name ?? channel.handle ?? '?').charAt(0).toUpperCase()}
              </Avatar>
            )}

            <Stack gap={4}>
              <Group gap="xs">
                <Text fw={700} size="lg">
                  {channel.display_name ?? channel.handle ?? 'Без названия'}
                </Text>
                <Badge variant="light" color={platform.color} leftSection={<PlatformIcon size={12} />}>
                  {platform.label}
                </Badge>
              </Group>

              <Group gap="md">
                {channel.subscribers_count != null && (
                  <Text size="sm" c="dimmed">
                    {channel.subscribers_count.toLocaleString('ru-RU')} подписчиков
                  </Text>
                )}
                {channel.posts_count != null && (
                  <Text size="sm" c="dimmed">
                    {channel.posts_count} публикаций
                  </Text>
                )}
                {channel.avg_views != null && (
                  <Group gap={4}>
                    <IconEye size={14} color="var(--mantine-color-dimmed)" />
                    <Text size="sm" c="dimmed">
                      ~{channel.avg_views.toLocaleString('ru-RU')} просмотров
                    </Text>
                  </Group>
                )}
              </Group>
            </Stack>
          </Group>

          <Tooltip label="Синхронизировать">
            <ActionIcon variant="light" size="lg" onClick={handleSync} loading={syncMutation.isPending}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Card>

      {/* Лента постов */}
      <Group gap="xs" align="center">
        <Text fw={600} size="lg">Публикации</Text>
        {postsData && (
          <Badge variant="light" size="sm">{postsData.total}</Badge>
        )}
      </Group>

      {postsLoading ? (
        <LoadingState message="Загрузка публикаций..." />
      ) : !postsData?.items.length ? (
        <EmptyState message="Публикации пока не загружены. Запустите синхронизацию." />
      ) : (
        <Stack gap="md">
          {postsData.items.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              isSelected={selectedPost?.id === post.id}
              onSelect={() => setSelectedPost(selectedPost?.id === post.id ? null : post)}
            />
          ))}

          {selectedPost && (
            <PostAnalysisPanel postId={selectedPost.id} />
          )}

          {postsData.pages > 1 && (
            <Group justify="center" mt="md">
              <Pagination
                total={postsData.pages}
                value={page}
                onChange={setPage}
              />
            </Group>
          )}
        </Stack>
      )}
    </Stack>
  )
}
