'use client'

import { useState } from 'react'
import { Button } from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { IconSend, IconX, IconTrash, IconDeselect } from '@tabler/icons-react'

import {
  usePublishContentPlanItemMutation,
  useUpdateContentPlanItemMutation,
  useDeleteContentPlanItemMutation,
} from '@/api/hooks/useContentPlan'

import styles from './bulk-action-bar.module.css'

function pluralize(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100
  const lastDigit = abs % 10
  if (abs > 10 && abs < 20) return many
  if (lastDigit > 1 && lastDigit < 5) return few
  if (lastDigit === 1) return one
  return many
}

interface BulkActionBarProps {
  selectedIds: Set<number>
  workspaceId: number
  onClearSelection: () => void
}

export function BulkActionBar({
  selectedIds,
  workspaceId,
  onClearSelection,
}: BulkActionBarProps) {
  const publishMutation = usePublishContentPlanItemMutation(workspaceId)
  const updateMutation = useUpdateContentPlanItemMutation(workspaceId)
  const deleteMutation = useDeleteContentPlanItemMutation(workspaceId)

  const [loading, setLoading] = useState<string | null>(null)

  const count = selectedIds.size
  if (count === 0) return null

  const ids = Array.from(selectedIds)

  const handleBulkPublish = async () => {
    setLoading('publish')
    try {
      const results = await Promise.allSettled(
        ids.map((id) => publishMutation.mutateAsync(id)),
      )
      const succeeded = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.filter((r) => r.status === 'rejected').length

      if (failed === 0) {
        notifications.show({
          title: 'Опубликовано',
          message: `${succeeded} ${pluralize(succeeded, 'элемент опубликован', 'элемента опубликовано', 'элементов опубликовано')}`,
          color: 'green',
        })
      } else {
        notifications.show({
          title: 'Частично опубликовано',
          message: `Успешно: ${succeeded}, ошибок: ${failed}`,
          color: 'yellow',
        })
      }
      onClearSelection()
    } finally {
      setLoading(null)
    }
  }

  const handleBulkCancel = async () => {
    setLoading('cancel')
    try {
      const results = await Promise.allSettled(
        ids.map((id) =>
          updateMutation.mutateAsync({
            itemId: id,
            data: { status: 'cancelled' } as never,
          }),
        ),
      )
      const succeeded = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.filter((r) => r.status === 'rejected').length

      if (failed === 0) {
        notifications.show({
          title: 'Отменено',
          message: `${succeeded} ${pluralize(succeeded, 'элемент отменён', 'элемента отменено', 'элементов отменено')}`,
          color: 'yellow',
        })
      } else {
        notifications.show({
          title: 'Частично отменено',
          message: `Успешно: ${succeeded}, ошибок: ${failed}`,
          color: 'yellow',
        })
      }
      onClearSelection()
    } finally {
      setLoading(null)
    }
  }

  const executeBulkDelete = async () => {
    setLoading('delete')
    try {
      const results = await Promise.allSettled(
        ids.map((id) => deleteMutation.mutateAsync(id)),
      )
      const succeeded = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.filter((r) => r.status === 'rejected').length

      if (failed === 0) {
        notifications.show({
          title: 'Удалено',
          message: `${succeeded} ${pluralize(succeeded, 'элемент удалён', 'элемента удалено', 'элементов удалено')}`,
          color: 'red',
        })
      } else {
        notifications.show({
          title: 'Частично удалено',
          message: `Успешно: ${succeeded}, ошибок: ${failed}`,
          color: 'yellow',
        })
      }
      onClearSelection()
    } finally {
      setLoading(null)
    }
  }

  const handleBulkDelete = () => {
    modals.openConfirmModal({
      title: 'Подтверждение удаления',
      children: `Вы уверены, что хотите удалить ${count} ${pluralize(count, 'элемент', 'элемента', 'элементов')}? Это действие необратимо.`,
      labels: { confirm: 'Удалить', cancel: 'Отмена' },
      confirmProps: { color: 'red' },
      onConfirm: executeBulkDelete,
    })
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.bar}>
        <span className={styles.count}>
          {count} {pluralize(count, 'элемент выбран', 'элемента выбрано', 'элементов выбрано')}
        </span>

        <div className={styles.actions}>
          <Button
            size="xs"
            variant="light"
            color="green"
            leftSection={<IconSend size={14} />}
            loading={loading === 'publish'}
            disabled={loading !== null && loading !== 'publish'}
            onClick={handleBulkPublish}
          >
            Опубликовать
          </Button>

          <Button
            size="xs"
            variant="light"
            color="yellow"
            leftSection={<IconX size={14} />}
            loading={loading === 'cancel'}
            disabled={loading !== null && loading !== 'cancel'}
            onClick={handleBulkCancel}
          >
            Отменить
          </Button>

          <Button
            size="xs"
            variant="light"
            color="red"
            leftSection={<IconTrash size={14} />}
            loading={loading === 'delete'}
            disabled={loading !== null && loading !== 'delete'}
            onClick={handleBulkDelete}
          >
            Удалить
          </Button>

          <Button
            size="xs"
            variant="subtle"
            color="gray"
            leftSection={<IconDeselect size={14} />}
            onClick={onClearSelection}
            className={styles.clearButton}
          >
            Снять
          </Button>
        </div>
      </div>
    </div>
  )
}
