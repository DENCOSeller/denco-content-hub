'use client'

import { type ReactNode } from 'react'
import {
  Modal,
  Stack,
  Text,
  Group,
  Button,
} from '@mantine/core'

interface ConfirmModalProps {
  opened: boolean
  onClose: () => void
  title: string
  children: ReactNode
  confirmLabel?: string
  onConfirm: () => void
  loading?: boolean
}

export function ConfirmModal({
  opened,
  onClose,
  title,
  children,
  confirmLabel = 'Удалить',
  onConfirm,
  loading,
}: ConfirmModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} centered>
      <Stack>
        <Text size="sm">{children}</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Отмена</Button>
          <Button color="red" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
