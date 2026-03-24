'use client'

import { type ReactNode } from 'react'
import { Group, Title, Text, Box } from '@mantine/core'

export interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode[]
}

export function PageHeader({ title, subtitle, actions = [] }: PageHeaderProps) {
  return (
    <Group justify="space-between" align="flex-start" wrap="wrap">
      <Box>
        <Title order={2} c="var(--text-primary)" style={{ letterSpacing: '-0.02em' }}>
          {title}
        </Title>
        {subtitle && (
          <Text size="sm" c="var(--text-secondary)" mt={2}>
            {subtitle}
          </Text>
        )}
      </Box>

      {actions.length > 0 && (
        <Group gap="sm">
          {actions.map((action, i) => (
            <Box key={i}>{action}</Box>
          ))}
        </Group>
      )}
    </Group>
  )
}
