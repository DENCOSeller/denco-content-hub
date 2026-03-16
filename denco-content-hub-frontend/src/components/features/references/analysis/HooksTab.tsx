'use client'

import { Stack, Text } from '@mantine/core'
import { IconQuote } from '@tabler/icons-react'

import type { AnalysisHook } from './types'
import styles from './analysis-tabs.module.css'

// ─── Props ───────────────────────────────────────────────────────────────────

interface HooksTabProps {
  data: AnalysisHook[]
}

// ─── Component ───────────────────────────────────────────────────────────────

export function HooksTab({ data }: HooksTabProps) {
  return (
    <Stack gap="sm">
      {data.map((hook, index) => (
        <div key={index} className={styles.hookRow}>
          <Stack gap="xs">
            <Text className={styles.hookQuote}>
              <IconQuote
                size={14}
                style={{ display: 'inline', marginRight: 6, opacity: 0.5 }}
              />
              {hook.hook}
            </Text>
            <Text size="xs" c="dimmed" lh={1.6}>
              {hook.explanation}
            </Text>
          </Stack>
        </div>
      ))}
    </Stack>
  )
}
