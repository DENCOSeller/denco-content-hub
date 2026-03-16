'use client'

import { Center, Loader, Stack, Text } from '@mantine/core'

interface LoadingStateProps {
  message?: string
}

export function LoadingState({ message = 'Загрузка...' }: LoadingStateProps) {
  return (
    <Center py="xl">
      <Stack align="center" gap="sm">
        <Loader size="lg" />
        <Text c="dimmed" size="sm">
          {message}
        </Text>
      </Stack>
    </Center>
  )
}
