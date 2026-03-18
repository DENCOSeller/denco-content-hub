'use client'

import { Stack, Text } from '@mantine/core'

import styles from './sections.module.css'

// ─── Props ───────────────────────────────────────────────────────────────────

interface QualityScoreProps {
  score: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getScoreClass(score: number): string {
  if (score <= 4) return styles.scoreLow
  if (score <= 7) return styles.scoreMedium
  return styles.scoreHigh
}

function getScoreLabel(score: number): string {
  if (score <= 3) return 'Низкое'
  if (score <= 5) return 'Ниже среднего'
  if (score <= 7) return 'Среднее'
  if (score <= 9) return 'Высокое'
  return 'Отличное'
}

// ─── Component ───────────────────────────────────────────────────────────────

export function QualityScore({ score }: QualityScoreProps) {
  return (
    <div className={styles.scoreWrapper}>
      <div className={`${styles.scoreCircle} ${getScoreClass(score)}`}>
        {score}
      </div>
      <Stack gap={0}>
        <Text fw={600} size="sm" c="gray.1">
          {getScoreLabel(score)}
        </Text>
        <Text size="xs" c="dimmed">
          Качество контента
        </Text>
      </Stack>
    </div>
  )
}
