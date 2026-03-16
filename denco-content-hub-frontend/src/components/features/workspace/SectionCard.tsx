'use client'

import { Card, Group, Text, ThemeIcon } from '@mantine/core'
import { IconChevronRight } from '@tabler/icons-react'
import Link from 'next/link'
import type { TablerIcon } from '@tabler/icons-react'

interface SectionCardProps {
  title: string
  description: string
  icon: TablerIcon
  href: string
}

export function SectionCard({ title, description, icon: Icon, href }: SectionCardProps) {
  return (
    <Card
      component={Link}
      href={href}
      withBorder
      padding="lg"
      style={{ textDecoration: 'none', cursor: 'pointer' }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group wrap="nowrap">
          <ThemeIcon size="xl" variant="light">
            <Icon size={24} />
          </ThemeIcon>
          <div>
            <Text fw={500}>{title}</Text>
            <Text size="sm" c="dimmed">
              {description}
            </Text>
          </div>
        </Group>
        <IconChevronRight size={20} color="var(--mantine-color-dimmed)" />
      </Group>
    </Card>
  )
}
