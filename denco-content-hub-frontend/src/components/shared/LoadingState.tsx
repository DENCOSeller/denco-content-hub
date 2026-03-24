'use client'

import { Stack, Skeleton } from '@mantine/core'

interface LoadingStateProps {
  /** @deprecated Kept for backward compatibility. Skeleton loading does not show messages. */
  message?: string
  variant?: 'default' | 'card' | 'list'
}

export function LoadingState({ variant = 'default' }: LoadingStateProps) {
  if (variant === 'card') {
    return (
      <Stack gap="md">
        <Skeleton height={200} radius="md" />
        <Skeleton height={16} width="60%" radius="sm" />
        <Skeleton height={12} width="40%" radius="sm" />
      </Stack>
    )
  }

  if (variant === 'list') {
    return (
      <Stack gap="sm">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height={48} radius="sm" />
        ))}
      </Stack>
    )
  }

  return (
    <Stack gap="md" py="lg">
      <Skeleton height={24} width="50%" radius="sm" />
      <Skeleton height={16} width="70%" radius="sm" />
      <Skeleton height={16} width="45%" radius="sm" />
      <Skeleton height={120} radius="md" />
    </Stack>
  )
}
