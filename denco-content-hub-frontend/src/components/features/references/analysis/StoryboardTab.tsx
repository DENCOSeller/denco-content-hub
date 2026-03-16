'use client'

import { Timeline, Text, Stack } from '@mantine/core'

import type { StoryboardBlock } from './types'
import styles from './analysis-tabs.module.css'

// ─── Props ───────────────────────────────────────────────────────────────────

interface StoryboardTabProps {
  data: StoryboardBlock[]
}

// ─── Component ───────────────────────────────────────────────────────────────

function formatTiming(block: StoryboardBlock): string {
  if (block.time_start && block.time_end) {
    return `${block.time_start} – ${block.time_end}`
  }
  if (block.time_start) {
    return block.time_start
  }
  if (block.block_number != null) {
    return `Блок ${block.block_number}`
  }
  return ''
}

export function StoryboardTab({ data }: StoryboardTabProps) {
  return (
    <Timeline active={data.length - 1} bulletSize={12} lineWidth={2}>
      {data.map((block, index) => (
        <Timeline.Item
          key={index}
          bullet={<div className={styles.timelineDot} />}
        >
          <Stack gap={4}>
            <span className={styles.timelineTiming}>{formatTiming(block)}</span>
            <Text fw={600} size="sm" c="gray.1">
              {block.topic}
            </Text>
            <Text size="xs" c="dimmed" lh={1.6}>
              {block.purpose}
            </Text>
          </Stack>
        </Timeline.Item>
      ))}
    </Timeline>
  )
}
