'use client'

import { Text } from '@mantine/core'

import styles from './sections.module.css'

// ─── Props ───────────────────────────────────────────────────────────────────

interface SummarySectionProps {
  summary: string
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SummarySection({ summary }: SummarySectionProps) {
  return (
    <div className={styles.summaryCard}>
      <Text size="sm" className={styles.summaryText}>
        {summary}
      </Text>
    </div>
  )
}
