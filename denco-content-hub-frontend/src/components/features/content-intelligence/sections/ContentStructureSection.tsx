'use client'

import { Badge, Group, Stack, Text } from '@mantine/core'

import type { ContentStructure } from '@/api/types/intelligence'
import styles from './sections.module.css'

// ─── Props ───────────────────────────────────────────────────────────────────

interface ContentStructureSectionProps {
  structure: ContentStructure
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ContentStructureSection({ structure }: ContentStructureSectionProps) {
  return (
    <div className={styles.structureCard}>
      <Stack gap="md">
        <div className={styles.structureRow}>
          <span className={styles.structureLabel}>Формат</span>
          <Badge variant="light" size="lg">{structure.format}</Badge>
        </div>

        {structure.opening_style && (
          <div className={styles.structureRow}>
            <span className={styles.structureLabel}>Открытие</span>
            <Text size="sm" c="gray.1">{structure.opening_style}</Text>
          </div>
        )}

        <div className={styles.structureRow}>
          <span className={styles.structureLabel}>CTA</span>
          <Group gap="xs">
            <Badge
              variant="light"
              color={structure.has_cta ? 'green' : 'gray'}
              size="sm"
            >
              {structure.has_cta ? 'Есть' : 'Нет'}
            </Badge>
            {structure.cta_type && (
              <Text size="xs" c="dimmed">{structure.cta_type}</Text>
            )}
          </Group>
        </div>
      </Stack>
    </div>
  )
}
