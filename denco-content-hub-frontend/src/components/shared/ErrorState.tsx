'use client'

import { Alert, Button, Stack } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'

interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

export function ErrorState({
  message = 'Произошла ошибка',
  onRetry,
}: ErrorStateProps) {
  return (
    <Alert icon={<IconAlertCircle />} color="red" title="Ошибка">
      <Stack gap="sm">
        {message}
        {onRetry && (
          <Button variant="light" color="red" size="xs" onClick={onRetry}>
            Повторить
          </Button>
        )}
      </Stack>
    </Alert>
  )
}
