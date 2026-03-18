'use client'

import { Text } from '@mantine/core'

import styles from './analysis-tabs.module.css'

// ─── Props ───────────────────────────────────────────────────────────────────

interface AudienceInsightsTabProps {
  data: string
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AudienceInsightsTab({ data }: AudienceInsightsTabProps) {
  return (
    <div className={styles.summaryCard}>
      <Text size="sm" className={styles.summaryText}>
        {data}
      </Text>
    </div>
  )
}
