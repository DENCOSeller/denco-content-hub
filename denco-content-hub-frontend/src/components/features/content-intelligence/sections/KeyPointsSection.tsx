'use client'

import { Group, Stack, Text } from '@mantine/core'

import type { KeyPoint } from '@/api/types/intelligence'
import styles from './sections.module.css'

// ─── Props ───────────────────────────────────────────────────────────────────

interface KeyPointsSectionProps {
  points: KeyPoint[]
}

// ─── Component ───────────────────────────────────────────────────────────────

export function KeyPointsSection({ points }: KeyPointsSectionProps) {
  return (
    <Stack gap="sm">
      {points.map((point, index) => (
        <div key={index} className={styles.keyPointCard}>
          <Group gap="sm" wrap="nowrap" align="flex-start">
            <div className={styles.keyPointIndex}>{index + 1}</div>
            <Stack gap={4}>
              <Text fw={600} size="sm" c="gray.1">
                {point.point}
              </Text>
              {point.importance && (
                <Text size="xs" c="dimmed" lh={1.6}>
                  {point.importance}
                </Text>
              )}
            </Stack>
          </Group>
        </div>
      ))}
    </Stack>
  )
}
