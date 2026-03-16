'use client'

import { Text } from '@mantine/core'

import type { AnalysisSummary } from './types'
import styles from './analysis-tabs.module.css'

// ─── Props ───────────────────────────────────────────────────────────────────

interface SummaryTabProps {
  data: AnalysisSummary
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SummaryTab({ data }: SummaryTabProps) {
  return (
    <div className={styles.summaryCard}>
      <Text size="sm" className={styles.summaryText}>
        {data.text}
      </Text>
    </div>
  )
}
