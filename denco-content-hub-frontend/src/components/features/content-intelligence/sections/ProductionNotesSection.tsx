'use client'

import { Badge, Group, Stack, Text } from '@mantine/core'

import type { ProductionNote } from '@/api/types/intelligence'
import styles from './sections.module.css'

// ─── Props ───────────────────────────────────────────────────────────────────

interface ProductionNotesSectionProps {
  notes: ProductionNote[]
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ProductionNotesSection({ notes }: ProductionNotesSectionProps) {
  return (
    <Stack gap="sm">
      {notes.map((note, index) => (
        <div key={index} className={styles.noteCard}>
          <Group gap="sm" wrap="nowrap" align="flex-start">
            {note.category && (
              <Badge variant="light" color="gray" size="sm">
                {note.category}
              </Badge>
            )}
            <Text size="sm" c="gray.1" lh={1.6}>
              {note.note}
            </Text>
          </Group>
        </div>
      ))}
    </Stack>
  )
}
