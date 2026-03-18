'use client'

import { Badge } from '@mantine/core'

// ─── Props ───────────────────────────────────────────────────────────────────

interface ToneBadgeProps {
  tone: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getToneColor(tone: string): string {
  const lower = tone.toLowerCase()
  if (lower.includes('позитив') || lower.includes('вдохнов')) return 'green'
  if (lower.includes('негатив') || lower.includes('критич')) return 'red'
  if (lower.includes('нейтрал') || lower.includes('информ')) return 'gray'
  if (lower.includes('юмор') || lower.includes('развлек')) return 'yellow'
  if (lower.includes('экспертн') || lower.includes('аналитич')) return 'blue'
  if (lower.includes('мотивац') || lower.includes('энерг')) return 'orange'
  return 'violet'
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ToneBadge({ tone }: ToneBadgeProps) {
  return (
    <Badge variant="light" color={getToneColor(tone)} size="lg">
      {tone}
    </Badge>
  )
}
