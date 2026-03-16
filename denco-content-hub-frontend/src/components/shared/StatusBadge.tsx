'use client'

import { Badge, Loader } from '@mantine/core'

const STATUS_LABELS: Record<string, string> = {
  pending: 'В очереди',
  processing: 'Обрабатывается',
  completed: 'Готово',
  failed: 'Ошибка',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'gray',
  processing: 'orange',
  completed: 'green',
  failed: 'red',
}

interface StatusBadgeProps {
  status: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const key = status.toLowerCase()
  const label = STATUS_LABELS[key] ?? status
  const color = STATUS_COLORS[key] ?? 'gray'
  const isActive = key === 'processing'

  return (
    <Badge
      color={color}
      variant="light"
      size={size}
      leftSection={isActive ? <Loader size={10} color={color} /> : undefined}
    >
      {label}
    </Badge>
  )
}
