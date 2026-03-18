'use client'

import { Group, Stack, Text } from '@mantine/core'
import { IconBulb } from '@tabler/icons-react'

import type { AnalysisContentIdea } from './types'
import styles from './analysis-tabs.module.css'

// ─── Props ───────────────────────────────────────────────────────────────────

interface ContentIdeasTabProps {
  data: AnalysisContentIdea[]
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ContentIdeasTab({ data }: ContentIdeasTabProps) {
  return (
    <Stack gap="sm">
      {data.map((idea, index) => (
        <div key={index} className={styles.thesisCard}>
          <Group gap="sm" wrap="nowrap" align="flex-start">
            <div className={styles.ideaIcon}>
              <IconBulb size={16} />
            </div>
            <Stack gap={4}>
              <Text fw={600} size="sm" c="gray.1">
                {idea.title}
              </Text>
              <Text size="sm" c="dimmed" lh={1.6}>
                {idea.description}
              </Text>
            </Stack>
          </Group>
        </div>
      ))}
    </Stack>
  )
}
