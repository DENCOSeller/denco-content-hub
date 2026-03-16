'use client'

import { useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Group,
  Stack,
  Text,
  ActionIcon,
  Box,
  Tabs,
} from '@mantine/core'
import { IconArrowLeft, IconExternalLink } from '@tabler/icons-react'

import { useContentDetailQuery, useTranscriptionQuery, useRetryContentMutation } from '@/api/hooks/useContent'
import { useAnalysisQuery, useGenerateAnalysisMutation } from '@/api/hooks/useAnalysis'
import type { AnalysisType } from '@/api/analysis'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { AppBreadcrumbs } from '@/components/shared/Breadcrumbs'
import { TranscriptionPanel } from '@/components/features/references/TranscriptionPanel'
import { AnalysisTabPanel } from '@/components/features/references/AnalysisTabPanel'
import { ContentChatTab } from '@/components/features/references/ContentChatTab'
import { extractYouTubeVideoId, formatDuration } from '@/lib/utils/youtube'
import { getSourceType, getSourceTypeInfo } from '@/lib/utils/source-type'

import styles from './content-detail.module.css'

const ANALYSIS_TABS: { value: AnalysisType; label: string }[] = [
  { value: 'summary', label: 'Резюме' },
  { value: 'theses', label: 'Тезисы' },
  { value: 'hooks', label: 'Хуки' },
  { value: 'storyboard', label: 'Раскадровка' },
]

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

  const {
    data: analysis,
    isLoading: analysisLoading,
    isError: analysisError,
    refetch: analysisRefetch,
  } = useAnalysisQuery(workspaceId, contentId)

  const retryMutation = useRetryContentMutation(workspaceId)
  const generateMutation = useGenerateAnalysisMutation(workspaceId, contentId)

  const sourceType = getSourceType(content?.source_type)
  const sourceInfo = getSourceTypeInfo(content?.source_type)
  const isYoutube = sourceType === 'youtube_video'
  const videoId = isYoutube
    ? (content?.video_id ?? extractYouTubeVideoId(content?.url ?? ''))
    : null

  function handleRetry() {
    retryMutation.mutate(contentId, {
      onSuccess: () => { contentRefetch(); transcriptionRefetch() },
    })
  }

  const handleGenerate = useCallback(() => {
    generateMutation.mutate(false)
  }, [generateMutation])

  function seekTo(seconds: number) {
    playerRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: 'seekTo', args: [seconds, true] }),
      '*',
    )
  }

  if (contentLoading) return <LoadingState message="Загрузка контента..." />
  if (contentError || !content) {
    return <ErrorState message="Не удалось загрузить контент" onRetry={contentRefetch} />
  }

  const breadcrumbs = [
    { label: activeWorkspace?.company_name ?? '' },
    { label: activeWorkspace?.name ?? '', href: `/workspaces/${workspaceId}` },
    { label: 'Референсы', href: `/workspaces/${workspaceId}/references` },
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
            </Box>
          </Stack>
        </div>

        {/* ── CENTER COLUMN — TABS ── */}
        <div className={styles.centerCol}>
          <Tabs defaultValue="transcription" keepMounted={false} className={styles.tabsRoot}>
            <Tabs.List className={styles.tabsList}>
              <Tabs.Tab value="transcription">{sourceInfo.transcriptionLabel}</Tabs.Tab>
              {ANALYSIS_TABS.map((tab) => (
                <Tabs.Tab key={tab.value} value={tab.value}>{tab.label}</Tabs.Tab>
              ))}
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

            {ANALYSIS_TABS.map((tab) => (
              <Tabs.Panel key={tab.value} value={tab.value} className={styles.tabPanel}>
                <AnalysisTabPanel
                  type={tab.value}
                  label={tab.label}
                  analysis={analysis}
                  isAnalysisLoading={analysisLoading}
                  isAnalysisError={analysisError}
                  isGenerating={generateMutation.isPending}
                  onGenerate={handleGenerate}
                  onRefetch={analysisRefetch}
                />
              </Tabs.Panel>
            ))}

            <Tabs.Panel value="ai-chat" className={styles.tabPanel}>
              <ContentChatTab workspaceId={workspaceId} contentId={contentId} />
            </Tabs.Panel>
          </Tabs>
        </div>
      </div>
    </>
  )
}
