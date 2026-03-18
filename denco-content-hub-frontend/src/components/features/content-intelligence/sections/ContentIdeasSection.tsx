'use client'

import { Group, Stack, Text } from '@mantine/core'
import { IconBulb } from '@tabler/icons-react'

import type { ContentIdea } from '@/api/types/intelligence'
import styles from './sections.module.css'

// ─── Props ───────────────────────────────────────────────────────────────────

interface ContentIdeasSectionProps {
  ideas: ContentIdea[]
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ContentIdeasSection({ ideas }: ContentIdeasSectionProps) {
  return (
    <Stack gap="sm">
      {ideas.map((idea, index) => (
        <div key={index} className={styles.ideaCard}>
          <Group gap="sm" wrap="nowrap" align="flex-start">
            <div className={styles.ideaIcon}>
              <IconBulb size={16} />
            </div>
            <Stack gap={4}>
              <Text fw={600} size="sm" c="gray.1">
                {idea.idea}
              </Text>
              <Text size="sm" c="dimmed" lh={1.6}>
                {idea.angle}
              </Text>
            </Stack>
          </Group>
        </div>
      ))}
    </Stack>
  )
}
