'use client'

import { Stack, Text, Timeline } from '@mantine/core'

import type { StoryboardEntry } from '@/api/types/intelligence'
import styles from './sections.module.css'

// ─── Props ───────────────────────────────────────────────────────────────────

interface StoryboardSectionProps {
  storyboard: StoryboardEntry[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTiming(entry: StoryboardEntry): string {
  if (entry.time_start && entry.time_end) {
    return `${entry.time_start} – ${entry.time_end}`
  }
  if (entry.time_start) {
    return entry.time_start
  }
  if (entry.block_number != null) {
    return `Блок ${entry.block_number}`
  }
  return ''
}

// ─── Component ───────────────────────────────────────────────────────────────

export function StoryboardSection({ storyboard }: StoryboardSectionProps) {
  return (
    <Timeline active={storyboard.length - 1} bulletSize={12} lineWidth={2}>
      {storyboard.map((entry, index) => (
        <Timeline.Item
          key={index}
          bullet={<div className={styles.timelineDot} />}
        >
          <Stack gap={4}>
            <span className={styles.timelineTiming}>{formatTiming(entry)}</span>
            <Text fw={600} size="sm" c="gray.1">
              {entry.topic}
            </Text>
            <Text size="xs" c="dimmed" lh={1.6}>
              {entry.purpose}
            </Text>
          </Stack>
        </Timeline.Item>
      ))}
    </Timeline>
  )
}
