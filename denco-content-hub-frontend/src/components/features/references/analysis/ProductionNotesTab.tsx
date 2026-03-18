'use client'

import { Text } from '@mantine/core'

import styles from './analysis-tabs.module.css'

// ─── Props ───────────────────────────────────────────────────────────────────

interface ProductionNotesTabProps {
  data: string
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ProductionNotesTab({ data }: ProductionNotesTabProps) {
  return (
    <div className={styles.summaryCard}>
      <Text size="sm" className={styles.summaryText}>
        {data}
      </Text>
    </div>
  )
}
