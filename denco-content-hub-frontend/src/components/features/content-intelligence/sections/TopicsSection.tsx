'use client'

import { Badge, Group } from '@mantine/core'

import type { TopicTag } from '@/api/types/intelligence'

// ─── Props ───────────────────────────────────────────────────────────────────

interface TopicsSectionProps {
  topics: TopicTag[]
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TopicsSection({ topics }: TopicsSectionProps) {
  return (
    <Group gap="xs">
      {topics.map((topic, index) => (
        <Badge key={index} variant="light" size="lg">
          {topic.name}
        </Badge>
      ))}
    </Group>
  )
}
