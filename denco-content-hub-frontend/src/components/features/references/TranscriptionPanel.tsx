'use client'

import {
  Group,
  Stack,
  Text,
  ScrollArea,
  Box,
  UnstyledButton,
} from '@mantine/core'
import { IconClock } from '@tabler/icons-react'

import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatTimecode } from '@/lib/utils/youtube'
import type { TranscriptionSegment } from '@/api/transcription'

import styles from './transcription-panel.module.css'

// ─── Speaker colors ──────────────────────────────────────────────────────────

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

// ─── Props ───────────────────────────────────────────────────────────────────

interface TranscriptionPanelProps {
  transcription: {
    status?: string
    segments?: TranscriptionSegment[] | null
    text?: string | null
    error_message?: string | null
  } | undefined
  transcriptionLoading: boolean
  transcriptionError: boolean
  contentStatus?: string
  contentErrorMessage?: string | null
  processingStep?: string | null
  videoId: string | null
  onRetry: () => void
  onRefetch: () => void
  seekTo: (seconds: number) => void
}

export function TranscriptionPanel({
  transcription,
  transcriptionLoading,
  transcriptionError,
  contentStatus,
  contentErrorMessage,
  processingStep,
  videoId,
  onRetry,
  onRefetch,
  seekTo,
}: TranscriptionPanelProps) {
  const statusLower = transcription?.status?.toLowerCase()
  const contentStatusLower = contentStatus?.toLowerCase()
  const isActive = statusLower === 'pending' || statusLower === 'processing'
  const segmentGroups = transcription?.segments
    ? groupBySpeaker(transcription.segments)
    : []

  if (transcriptionLoading) return <LoadingState message="Загрузка транскрипции..." />
  if (transcriptionError) {
    return <ErrorState message="Не удалось загрузить транскрипцию" onRetry={onRefetch} />
  }
  if (contentStatusLower === 'failed') {
    return <ErrorState message={contentErrorMessage ?? 'Ошибка обработки видео'} onRetry={onRetry} />
  }
  if (isActive) {
    return <LoadingState message={processingStep ?? 'Обработка...'} />
  }
  if (statusLower === 'failed' && transcription) {
    return <ErrorState message={transcription.error_message ?? 'Ошибка транскрипции'} onRetry={onRetry} />
  }
  if (statusLower === 'completed' && !transcription?.segments && !transcription?.text) {
    return <EmptyState message="Транскрипция пуста" />
  }

  if (statusLower === 'completed' && segmentGroups.length > 0) {
    return (
      <ScrollArea flex={1} offsetScrollbars>
        <Stack gap={0}>
          {segmentGroups.map((group, gi) => (
            <Box key={gi}>
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
              {group.segments.map((segment, si) => (
                <Group
                  key={si}
                  gap="sm"
                  wrap="nowrap"
                  align="flex-start"
                  className={styles.segmentRow}
                >
                  <UnstyledButton
                    className={videoId ? styles.timecodeLink : styles.timecode}
                    onClick={videoId ? () => seekTo(segment.start) : undefined}
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
    )
  }

  if (statusLower === 'completed' && transcription?.text) {
    return (
      <ScrollArea flex={1} offsetScrollbars>
        <Text size="sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
          {transcription.text}
        </Text>
      </ScrollArea>
    )
  }

  return null
}
