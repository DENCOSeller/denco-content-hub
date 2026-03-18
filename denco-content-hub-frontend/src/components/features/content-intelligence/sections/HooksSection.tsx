'use client'

import { Stack, Text } from '@mantine/core'
import { IconQuote } from '@tabler/icons-react'

import type { IntelligenceHook } from '@/api/types/intelligence'
import styles from './sections.module.css'

// ─── Props ───────────────────────────────────────────────────────────────────

interface HooksSectionProps {
  hooks: IntelligenceHook[]
}

// ─── Component ───────────────────────────────────────────────────────────────

export function HooksSection({ hooks }: HooksSectionProps) {
  return (
    <Stack gap="sm">
      {hooks.map((hook, index) => (
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
