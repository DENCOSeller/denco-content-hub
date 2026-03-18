'use client'

import { Group, Stack, Text } from '@mantine/core'
import { IconUsers } from '@tabler/icons-react'

import type { AudienceInsight } from '@/api/types/intelligence'
import styles from './sections.module.css'

// ─── Props ───────────────────────────────────────────────────────────────────

interface AudienceInsightsSectionProps {
  insights: AudienceInsight[]
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AudienceInsightsSection({ insights }: AudienceInsightsSectionProps) {
  return (
    <Stack gap="sm">
      {insights.map((insight, index) => (
        <div key={index} className={styles.insightCard}>
          <Group gap="sm" wrap="nowrap" align="flex-start">
            <div className={styles.insightIcon}>
              <IconUsers size={16} />
            </div>
            <Stack gap={4}>
              <Text fw={600} size="sm" c="gray.1">
                {insight.insight}
              </Text>
              {insight.recommendation && (
                <Text size="xs" c="dimmed" lh={1.6}>
                  {insight.recommendation}
                </Text>
              )}
            </Stack>
          </Group>
        </div>
      ))}
    </Stack>
  )
}
