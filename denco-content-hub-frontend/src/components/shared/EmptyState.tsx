'use client'

import { Center, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconInbox } from '@tabler/icons-react'

interface EmptyStateProps {
  message?: string
}

export function EmptyState({ message = 'Нет данных' }: EmptyStateProps) {
  return (
    <Center py="xl">
      <Stack align="center" gap="sm">
        <ThemeIcon size="xl" variant="light" color="gray">
          <IconInbox />
        </ThemeIcon>
        <Text c="dimmed" size="sm">
          {message}
        </Text>
      </Stack>
    </Center>
  )
}
