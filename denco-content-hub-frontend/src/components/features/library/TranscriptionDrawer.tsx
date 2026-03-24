'use client'

import { useRef } from 'react'
import {
  Drawer,
  Stack,
  Group,
  Text,
  Badge,
  ScrollArea,
  Box,
  UnstyledButton,
} from '@mantine/core'
import { IconClock } from '@tabler/icons-react'

import { useTranscriptionQuery } from '@/api/hooks/useContent'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import type { TranscriptionSegment } from '@/api/transcription'

import styles from './TranscriptionDrawer.module.css'

interface ContentMeta {
  id: number
  title: string | null
  url: string
  videoId: string | null
  duration: number | null
  createdAt: string
  processingStep?: string | null
}

interface TranscriptionDrawerProps {
  opened: boolean
  onClose: () => void
  workspaceId: number
  content: ContentMeta | null
}

function formatTimecode(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function extractYouTubeVideoId(url: string): string | null {
  try {
    const normalized = url.match(/^https?:\/\//) ? url : `https://${url}`
    const parsed = new URL(normalized)
    if (
      parsed.hostname === 'www.youtube.com' ||
      parsed.hostname === 'youtube.com' ||
      parsed.hostname === 'm.youtube.com'
    ) {
      return parsed.searchParams.get('v')
    }
    if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.slice(1).split('/')[0] || null
    }
  } catch {
    // invalid URL
  }
  return null
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ─── Speaker grouping ──────────────────────────────────────────────────────────

const SPEAKER_COLORS = [
  '#14B8A6', '#30D158', '#FF9F0A', '#FF375F', '#2dd4bf', '#BF5AF2',
]

function getSpeakerColor(speaker: string): string {
  const num = parseInt(speaker.replace(/\D/g, '') || '1', 10)
  return SPEAKER_COLORS[(num - 1) % SPEAKER_COLORS.length]
}

interface SegmentGroup {
  speaker: string | null
  segments: TranscriptionSegment[]
}

function groupBySpeaker(segments: TranscriptionSegment[]): SegmentGroup[] {
  const hasSpeakers = segments.some((s) => s.speaker)
  if (!hasSpeakers) return [{ speaker: null, segments }]

  const groups: SegmentGroup[] = []
  let current: SegmentGroup | null = null

  for (const segment of segments) {
    const speaker = segment.speaker ?? null
    if (!current || current.speaker !== speaker) {
      current = { speaker, segments: [segment] }
      groups.push(current)
    } else {
      current.segments.push(segment)
    }
  }
  return groups
}

export function TranscriptionDrawer({
  opened,
  onClose,
  workspaceId,
  content,
}: TranscriptionDrawerProps) {
  const contentId = content?.id ?? 0
  const playerRef = useRef<HTMLIFrameElement>(null)

  function seekTo(seconds: number) {
    playerRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: 'seekTo', args: [seconds, true] }),
      '*',
    )
  }

  const {
    data: transcription,
    isLoading,
    isError,
    refetch,
  } = useTranscriptionQuery(workspaceId, contentId)

  const youtubeVideoId =
    content?.videoId ?? extractYouTubeVideoId(content?.url ?? '')

  const statusLower = transcription?.status?.toLowerCase()
  const isActive = statusLower === 'pending' || statusLower === 'processing'

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="lg"
      title={
        <Text fw={600} size="lg" truncate="end">
          Транскрипция
        </Text>
      }
    >
      {content && (
        <Stack gap="md" h="100%">
          {/* YouTube player */}
          {youtubeVideoId && (
            <Box className={styles.playerWrapper}>
              <iframe
                ref={playerRef}
                src={`https://www.youtube.com/embed/${youtubeVideoId}?enablejsapi=1`}
                title={content.title ?? 'YouTube video'}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className={styles.playerIframe}
              />
            </Box>
          )}

          {/* Video meta */}
          <Box className={styles.metaBlock}>
            <Text fw={500} size="sm" lineClamp={2}>
              {content.title ?? content.url}
            </Text>
            <Group gap="xs" mt={4}>
              <Text size="xs" c="dimmed">
                {formatDuration(content.duration)}
              </Text>
              <Text size="xs" c="dimmed">
                {new Date(content.createdAt).toLocaleDateString('ru-RU')}
              </Text>
              {transcription && (
                <StatusBadge status={transcription.status} size="xs" />
              )}
              {transcription?.language && (
                <Badge size="xs" variant="outline" color="gray">
                  {transcription.language}
                </Badge>
              )}
            </Group>
          </Box>

          {/* Transcription content */}
          {isLoading && <LoadingState message="Загрузка транскрипции..." />}

          {isError && (
            <ErrorState
              message="Не удалось загрузить транскрипцию"
              onRetry={refetch}
            />
          )}

          {!isLoading && !isError && isActive && (
            <LoadingState message={content.processingStep ?? 'Обработка...'} />
          )}

          {!isLoading && !isError && transcription && statusLower === 'failed' && (
            <ErrorState
              message={
                transcription.error_message ?? 'Ошибка транскрипции'
              }
            />
          )}

          {!isLoading &&
            !isError &&
            transcription &&
            statusLower === 'completed' &&
            !transcription.text &&
            !transcription.segments && (
              <EmptyState message="Транскрипция пуста" />
            )}

          {!isLoading &&
            !isError &&
            transcription &&
            statusLower === 'completed' &&
            transcription.segments &&
            transcription.segments.length > 0 && (
              <ScrollArea flex={1} offsetScrollbars>
                <Stack gap={0}>
                  {groupBySpeaker(transcription.segments).map((group, groupIndex) => (
                    <Box key={groupIndex}>
                      {group.speaker && (
                        <div className={styles.speakerHeader}>
                          <div
                            className={styles.speakerDot}
                            style={{ background: getSpeakerColor(group.speaker) }}
                          />
                          <Text
                            className={styles.speakerLabel}
                            style={{ color: getSpeakerColor(group.speaker) }}
                          >
                            {group.speaker}
                          </Text>
                        </div>
                      )}
                      {group.segments.map((segment, segIndex) => (
                        <Group
                          key={segIndex}
                          gap="sm"
                          wrap="nowrap"
                          align="flex-start"
                          className={styles.segmentRow}
                        >
                          <UnstyledButton
                            className={youtubeVideoId ? styles.timecodeLink : styles.timecode}
                            onClick={youtubeVideoId ? () => seekTo(segment.start) : undefined}
                          >
                            <IconClock size={12} />
                            <Text size="xs" ff="monospace" inherit>
                              {formatTimecode(segment.start)}
                            </Text>
                          </UnstyledButton>
                          <Text size="sm" className={styles.segmentText}>
                            {segment.text}
                          </Text>
                        </Group>
                      ))}
                    </Box>
                  ))}
                </Stack>
              </ScrollArea>
            )}

          {!isLoading &&
            !isError &&
            transcription &&
            statusLower === 'completed' &&
            !transcription.segments &&
            transcription.text && (
              <ScrollArea flex={1} offsetScrollbars>
                <Text size="sm" className={styles.plainText}>
                  {transcription.text}
                </Text>
              </ScrollArea>
            )}
        </Stack>
      )}
    </Drawer>
  )
}
