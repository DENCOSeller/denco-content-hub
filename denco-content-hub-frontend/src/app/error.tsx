'use client'

import { Button, Center, Stack, Text, Title } from '@mantine/core'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <Center mih="100vh" bg="var(--app-bg)">
      <Stack align="center" gap="md">
        <Title order={2} c="red.5">
          Что-то пошло не так
        </Title>
        <Text c="dimmed" size="md">
          Произошла непредвиденная ошибка
        </Text>
        <Button variant="light" color="red" onClick={reset}>
          Попробовать снова
        </Button>
      </Stack>
    </Center>
  )
}
