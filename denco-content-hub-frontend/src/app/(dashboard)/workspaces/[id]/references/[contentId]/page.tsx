'use client'

import { useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Group,
  Stack,
  Text,
  ActionIcon,
  Box,
  Tabs,
} from '@mantine/core'
import {
  IconArrowLeft,
  IconExternalLink,
  IconEye,
  IconThumbUp,
  IconMessageCircle,
  IconCalendar,
  IconUser,
} from '@tabler/icons-react'

import { useContentDetailQuery, useTranscriptionQuery, useRetryContentMutation } from '@/api/hooks/useContent'
import type { ContentItemWithYouTube } from '@/api/types/content'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { AppBreadcrumbs } from '@/components/shared/Breadcrumbs'
import { TranscriptionPanel } from '@/components/features/references/TranscriptionPanel'
import { ContentIntelligencePanel } from '@/components/features/content-intelligence'
import { ContentChatTab } from '@/components/features/references/ContentChatTab'
import { extractYouTubeVideoId, formatDuration, formatNumber } from '@/lib/utils/youtube'
import { getSourceType, getSourceTypeInfo } from '@/lib/utils/source-type'

import styles from './content-detail.module.css'

export default function WorkspaceContentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const playerRef = useRef<HTMLIFrameElement>(null)

  const workspaceId = Number(params.id)
  const contentId = Number(params.contentId)
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)

  const {
    data: content,
    isLoading: contentLoading,
    isError: contentError,
    refetch: contentRefetch,
  } = useContentDetailQuery(workspaceId, contentId)

  const {
    data: transcription,
    isLoading: transcriptionLoading,
    isError: transcriptionError,
    refetch: transcriptionRefetch,
  } = useTranscriptionQuery(workspaceId, contentId, content?.status)

  const retryMutation = useRetryContentMutation(workspaceId)

  const ytContent = content as ContentItemWithYouTube | undefined
  const sourceType = getSourceType(content?.source_type)
  const sourceInfo = getSourceTypeInfo(content?.source_type)
  const isYoutube = sourceType === 'youtube_video'
  const videoId = isYoutube
    ? (content?.video_id ?? extractYouTubeVideoId(content?.url ?? ''))
    : null
  const hasYouTubeMetrics = isYoutube && ytContent && (
    ytContent.views_count != null || ytContent.likes_count != null || ytContent.comments_count != null
  )

  function handleRetry() {
    retryMutation.mutate(contentId, {
      onSuccess: () => { contentRefetch(); transcriptionRefetch() },
    })
  }

  function seekTo(seconds: number) {
    playerRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: 'seekTo', args: [seconds, true] }),
      '*',
    )
  }

  const baseBreadcrumbs = [
    { label: activeWorkspace?.company_name ?? '' },
    { label: activeWorkspace?.name ?? '', href: `/workspaces/${workspaceId}` },
    { label: 'Референсы', href: `/workspaces/${workspaceId}/references` },
  ]

  if (contentLoading) return (
    <Stack gap="md">
      <AppBreadcrumbs items={[...baseBreadcrumbs, { label: '...' }]} />
      <LoadingState message="Загрузка контента..." />
    </Stack>
  )
  if (contentError || !content) {
    return (
      <Stack gap="md">
        <AppBreadcrumbs items={[...baseBreadcrumbs, { label: 'Ошибка' }]} />
        <ErrorState message="Не удалось загрузить контент" onRetry={contentRefetch} />
      </Stack>
    )
  }

  const breadcrumbs = [
    ...baseBreadcrumbs,
    { label: content.title ?? 'Детали' },
  ]

  const effectiveStatus = transcription?.status ?? content.status

  return (
    <>
      <AppBreadcrumbs items={breadcrumbs} />

      <div className={styles.layout}>
        {/* ── LEFT COLUMN ── */}
        <div className={styles.leftCol}>
          <Stack gap="md">
            <Group gap="xs">
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => router.push(`/workspaces/${workspaceId}/references`)}
                aria-label="Назад"
              >
                <IconArrowLeft size={18} />
              </ActionIcon>
              <Text size="sm" c="dimmed">Назад</Text>
            </Group>

            {isYoutube && videoId ? (
              <Box className={styles.playerWrapper}>
                <iframe
                  ref={playerRef}
                  src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1`}
                  title={content.title ?? 'YouTube video'}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className={styles.playerIframe}
                />
              </Box>
            ) : isYoutube ? (
              <Box className={styles.playerPlaceholder}>
                <Text size="sm" c="dimmed">Плеер недоступен</Text>
              </Box>
            ) : (
              <Box className={styles.playerPlaceholder}>
                <Stack align="center" gap="xs">
                  {sourceInfo.icon(48)}
                  <Text size="sm" fw={500} c="gray.3" ta="center" lineClamp={2}>
                    {content.title ?? content.url}
                  </Text>
                  {sourceType === 'web_page' && content.url && (
                    <Group gap={4}>
                      <IconExternalLink size={14} color="var(--mantine-color-blue-6)" />
                      <Text
                        component="a"
                        href={content.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="xs"
                        c="blue"
                        style={{ textDecoration: 'none' }}
                      >
                        Открыть источник
                      </Text>
                    </Group>
                  )}
                </Stack>
              </Box>
            )}

            <Box className={styles.metaBlock}>
              <Text fw={600} size="sm" lineClamp={3} mb={8}>
                {content.title ?? content.url}
              </Text>
              <Group gap="xs" mb={6}>
                <StatusBadge status={effectiveStatus} size="xs" />
              </Group>
              <Group gap={6}>
                <Text size="xs" c="dimmed">{formatDuration(content.duration)}</Text>
                <Text size="xs" c="dimmed">·</Text>
                <Text size="xs" c="dimmed">
                  {new Date(content.created_at).toLocaleDateString('ru-RU')}
                </Text>
                <Text size="xs" c="dimmed">·</Text>
                <Text size="xs" c="dimmed">{sourceInfo.label}</Text>
              </Group>

              {hasYouTubeMetrics && ytContent && (
                <Group gap="md" mt={8}>
                  {ytContent.views_count != null && (
                    <Group gap={4}>
                      <IconEye size={14} color="var(--mantine-color-dimmed)" />
                      <Text size="xs" c="dimmed">{formatNumber(ytContent.views_count)}</Text>
                    </Group>
                  )}
                  {ytContent.likes_count != null && (
                    <Group gap={4}>
                      <IconThumbUp size={14} color="var(--mantine-color-dimmed)" />
                      <Text size="xs" c="dimmed">{formatNumber(ytContent.likes_count)}</Text>
                    </Group>
                  )}
                  {ytContent.comments_count != null && (
                    <Group gap={4}>
                      <IconMessageCircle size={14} color="var(--mantine-color-dimmed)" />
                      <Text size="xs" c="dimmed">{formatNumber(ytContent.comments_count)}</Text>
                    </Group>
                  )}
                  {ytContent.published_at && (
                    <Group gap={4}>
                      <IconCalendar size={14} color="var(--mantine-color-dimmed)" />
                      <Text size="xs" c="dimmed">
                        {new Date(ytContent.published_at).toLocaleDateString('ru-RU')}
                      </Text>
                    </Group>
                  )}
                  {ytContent.channel_title && (
                    <Group gap={4}>
                      <IconUser size={14} color="var(--mantine-color-dimmed)" />
                      <Text size="xs" c="dimmed">{ytContent.channel_title}</Text>
                    </Group>
                  )}
                </Group>
              )}
            </Box>
          </Stack>
        </div>

        {/* ── CENTER COLUMN — TABS ── */}
        <div className={styles.centerCol}>
          <Tabs defaultValue="transcription" keepMounted={false} className={styles.tabsRoot}>
            <Tabs.List className={styles.tabsList}>
              <Tabs.Tab value="transcription">{sourceInfo.transcriptionLabel}</Tabs.Tab>
              <Tabs.Tab value="analysis">Анализ</Tabs.Tab>
              <Tabs.Tab value="ai-chat">AI Чат</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="transcription" className={styles.tabPanel}>
              <TranscriptionPanel
                transcription={transcription}
                transcriptionLoading={transcriptionLoading}
                transcriptionError={transcriptionError}
                contentStatus={content.status}
                contentErrorMessage={content.error_message}
                processingStep={(content as { processing_step?: string | null }).processing_step}
                videoId={videoId}
                onRetry={handleRetry}
                onRefetch={transcriptionRefetch}
                seekTo={seekTo}
              />
            </Tabs.Panel>

            <Tabs.Panel value="analysis" className={styles.tabPanel}>
              <ContentIntelligencePanel
                sourceType="reference"
                sourceId={contentId}
                workspaceId={workspaceId}
              />
            </Tabs.Panel>

            <Tabs.Panel value="ai-chat" className={styles.tabPanel}>
              <ContentChatTab workspaceId={workspaceId} contentId={contentId} />
            </Tabs.Panel>
          </Tabs>
        </div>
      </div>
    </>
  )
}
