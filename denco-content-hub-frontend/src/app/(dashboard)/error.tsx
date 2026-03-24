'use client'

import { Button, Center, Stack, Text, Title } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function DashboardErrorPage({ reset }: ErrorPageProps) {
  return (
    <Center py={80}>
      <Stack align="center" gap="md">
        <IconAlertTriangle size={48} color="var(--color-destructive)" />
        <Title order={3} c="var(--text-primary)">
          Что-то пошло не так
        </Title>
        <Text c="dimmed" size="sm" ta="center" maw={360}>
          Произошла непредвиденная ошибка. Попробуйте обновить страницу.
        </Text>
        <Button variant="light" color="red" onClick={reset}>
          Попробовать снова
        </Button>
      </Stack>
    </Center>
  )
}
