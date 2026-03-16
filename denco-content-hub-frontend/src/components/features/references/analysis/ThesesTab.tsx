'use client'

import { Group, Stack, Text } from '@mantine/core'

import type { AnalysisThesis } from './types'
import styles from './analysis-tabs.module.css'

// ─── Props ───────────────────────────────────────────────────────────────────

interface ThesesTabProps {
  data: AnalysisThesis[]
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ThesesTab({ data }: ThesesTabProps) {
  return (
    <Stack gap="sm">
      {data.map((thesis, index) => (
        <div key={index} className={styles.thesisCard}>
          <Group gap="sm" wrap="nowrap" align="flex-start">
            <div className={styles.thesisIndex}>{index + 1}</div>
            <Stack gap={4}>
              <Text fw={600} size="sm" c="gray.1">
                {thesis.title}
              </Text>
              <Text size="sm" c="dimmed" lh={1.6}>
                {thesis.description}
              </Text>
            </Stack>
          </Group>
        </div>
      ))}
    </Stack>
  )
}
