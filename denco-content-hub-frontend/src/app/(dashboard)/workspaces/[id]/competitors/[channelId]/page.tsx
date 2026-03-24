'use client'

import { useState } from 'react'
import {
  Stack,
  Group,
  Text,
  Avatar,
  Badge,
  Card,
  Pagination,
  ActionIcon,
  Tooltip,
  Tabs,
  Skeleton,
} from '@mantine/core'
import {
  IconArrowLeft,
  IconEye,
  IconRefresh,
  IconChartLine,
  IconList,
} from '@tabler/icons-react'
import { useParams, useRouter } from 'next/navigation'

import {
  useCompetitorDetailQuery,
  useCompetitorPostsQuery,
  useSyncCompetitorMutation,
} from '@/api/hooks/useCompetitors'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useSetAiPageContext } from '@/stores/ai-page-store'
import { AppBreadcrumbs } from '@/components/shared/Breadcrumbs'
import { ErrorState } from '@/components/shared/ErrorState'
import { EmptyState } from '@/components/shared/EmptyState'
import type { CompetitorPost } from '@/api/types/competitor'
import { PostCard } from '@/components/features/competitors/PostCard'
import { ContentIntelligencePanel } from '@/components/features/content-intelligence'
import { AnalyticsTab } from '@/components/features/competitors/AnalyticsTab'
import { platformConfig } from '@/components/features/competitors/constants'
import { notifications } from '@mantine/notifications'

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

  const loadingBreadcrumbs = [
    { label: activeWorkspace?.company_name ?? '' },
    { label: activeWorkspace?.name ?? '', href: `/workspaces/${workspaceId}` },
    { label: 'Мониторинг', href: `/workspaces/${workspaceId}/competitors` },
    { label: '...' },
  ]

  if (isLoading) return (
    <Stack>
      <AppBreadcrumbs items={loadingBreadcrumbs} />
      <Card withBorder padding="lg" radius="md">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="md" wrap="nowrap">
            <Skeleton circle height={56} />
            <Stack gap={4} style={{ flex: 1 }}>
              <Group gap="xs">
                <Skeleton height={22} width={180} />
                <Skeleton height={20} width={80} radius="xl" />
              </Group>
              <Group gap="md">
                <Skeleton height={14} width={100} />
                <Skeleton height={14} width={80} />
                <Skeleton height={14} width={120} />
              </Group>
            </Stack>
          </Group>
        </Group>
      </Card>
      <Stack gap="md">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} withBorder padding="md" radius="md">
            <Group gap="md" wrap="nowrap" align="flex-start">
              <Skeleton width={160} height={90} radius="md" />
              <Stack gap="xs" style={{ flex: 1 }}>
                <Skeleton height={14} width="80%" />
                <Skeleton height={14} width="50%" />
                <Group gap="md">
                  <Skeleton height={12} width={50} />
                  <Skeleton height={12} width={50} />
                  <Skeleton height={12} width={50} />
                </Group>
              </Stack>
            </Group>
          </Card>
        ))}
      </Stack>
    </Stack>
  )
  if (isError || !channel) return (
    <Stack>
      <AppBreadcrumbs items={loadingBreadcrumbs} />
      <ErrorState onRetry={refetch} />
    </Stack>
  )

  const platform = platformConfig[channel.platform]
  const PlatformIcon = platform.icon

  const breadcrumbs = [
    { label: activeWorkspace?.company_name ?? '' },
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

      {/* Табы: Посты / Аналитика */}
      <Tabs defaultValue="posts">
        <Tabs.List>
          <Tabs.Tab value="posts" leftSection={<IconList size={16} />}>
            Посты
            {postsData && (
              <Badge variant="light" size="xs" ml={6}>{postsData.total}</Badge>
            )}
          </Tabs.Tab>
          <Tabs.Tab value="analytics" leftSection={<IconChartLine size={16} />}>
            Аналитика
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="posts" pt="md">
          {postsLoading ? (
            <Stack gap="md">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} withBorder padding="md" radius="md">
                  <Group gap="md" wrap="nowrap" align="flex-start">
                    <Skeleton width={160} height={90} radius="md" />
                    <Stack gap="xs" style={{ flex: 1 }}>
                      <Skeleton height={14} width="80%" />
                      <Skeleton height={14} width="50%" />
                      <Group gap="md">
                        <Skeleton height={12} width={50} />
                        <Skeleton height={12} width={50} />
                        <Skeleton height={12} width={50} />
                      </Group>
                    </Stack>
                  </Group>
                </Card>
              ))}
            </Stack>
          ) : !postsData?.items.length ? (
            <EmptyState message="Публикации пока не загружены. Запустите синхронизацию." />
          ) : (
            <Stack gap="md">
              {postsData.items.map((post) => (
                <Stack key={post.id} gap="md">
                  <PostCard
                    post={post}
                    isSelected={selectedPost?.id === post.id}
                    onSelect={() => setSelectedPost(selectedPost?.id === post.id ? null : post)}
                  />
                  {selectedPost?.id === post.id && (
                    <Card withBorder radius="md" padding="md">
                      <ContentIntelligencePanel
                        sourceType="competitor_post"
                        sourceId={post.id}
                        workspaceId={workspaceId}
                      />
                    </Card>
                  )}
                </Stack>
              ))}

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
        </Tabs.Panel>

        <Tabs.Panel value="analytics" pt="md">
          <AnalyticsTab channelId={channelId} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
