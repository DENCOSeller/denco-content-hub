'use client'

import { useState } from 'react'
import { Alert, Button, Group, Text } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'

interface ConflictBannerProps {
  conflictCount: number
  onReviewClick: () => void
}

export function ConflictBanner({ conflictCount, onReviewClick }: ConflictBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (conflictCount === 0 || dismissed) return null

  return (
    <Alert
      icon={<IconAlertTriangle size={16} />}
      color="orange"
      variant="light"
      withCloseButton
      onClose={() => setDismissed(true)}
    >
      <Group justify="space-between" wrap="nowrap">
        <Text size="sm">
          Обнаружено конфликтов: {conflictCount}. Узлы компании и рабочего пространства
          содержат противоречивую информацию.
        </Text>
        <Button
          size="xs"
          variant="subtle"
          color="orange"
          onClick={onReviewClick}
        >
          Просмотреть
        </Button>
      </Group>
    </Alert>
  )
}
