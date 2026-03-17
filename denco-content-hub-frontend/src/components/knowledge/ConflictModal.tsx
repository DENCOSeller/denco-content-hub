'use client'

import { useState, useCallback } from 'react'
import { Modal, Badge, Text, ActionIcon, Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'

import type {
  KgConflictResponse,
  ResolveConflictBody,
} from '@/api/hooks/useKgConflicts'
import { useResolveConflict } from '@/api/hooks/useKgConflicts'
import type { KnowledgeNodeResponse } from '@/api/client/types.gen'

import styles from './ConflictModal.module.css'

interface ConflictModalProps {
  opened: boolean
  onClose: () => void
  conflicts: KgConflictResponse[]
  workspaceId: number
}

function extractText(node: KnowledgeNodeResponse | null): string {
  if (!node) return ''
  if (node.content_text) return node.content_text
  return ''
}

function NodeSide({
  label,
  node,
  variant,
}: {
  label: string
  node: KnowledgeNodeResponse | null
  variant: 'company' | 'workspace'
}) {
  const panelClass = `${styles.sidePanel} ${
    variant === 'company'
      ? styles.sidePanelCompany
      : styles.sidePanelWorkspace
  }`
  const color = variant === 'company' ? '#3b82f6' : '#a855f7'
  const text = extractText(node)

  return (
    <div className={panelClass}>
      <Text className={styles.sideHeader} c={color}>
        {label}
      </Text>
      {node ? (
        <>
          <Text className={styles.nodeTitle}>{node.title}</Text>
          {text ? (
            <div className={styles.nodeContent}>{text}</div>
          ) : (
            <Text className={styles.nodeEmpty}>Нет содержания</Text>
          )}
        </>
      ) : (
        <Text className={styles.nodeEmpty}>Узел не найден</Text>
      )}
    </div>
  )
}

export function ConflictModal({
  opened,
  onClose,
  conflicts,
  workspaceId,
}: ConflictModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const resolve = useResolveConflict(workspaceId)

  const total = conflicts.length
  const conflict = conflicts[currentIndex] as
    | KgConflictResponse
    | undefined

  const handleClose = useCallback(() => {
    setCurrentIndex(0)
    onClose()
  }, [onClose])

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, total - 1))
  }, [total])

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0))
  }, [])

  const handleAction = useCallback(
    (status: ResolveConflictBody['status']) => {
      if (!conflict) return

      resolve.mutate(
        { conflictId: conflict.id, body: { status } },
        {
          onSuccess: () => {
            const label =
              status === 'resolved' ? 'Разрешён' : 'Отклонён'
            notifications.show({
              title: `Конфликт ${label.toLowerCase()}`,
              message: `Конфликт #${conflict.id} ${label.toLowerCase()}`,
              color: status === 'resolved' ? 'blue' : 'gray',
            })

            // After refetch, resolved conflict disappears from array,
            // so next conflict naturally appears at current index.
            // Only close if this was the last one.
            if (total <= 1) {
              handleClose()
            } else if (currentIndex >= total - 1) {
              setCurrentIndex((prev) => Math.max(0, prev - 1))
            }
          },
          onError: () => {
            notifications.show({
              title: 'Ошибка',
              message: 'Не удалось обработать конфликт',
              color: 'red',
            })
          },
        },
      )
    },
    [conflict, resolve, currentIndex, total, handleClose],
  )

  if (!total) return null

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <>
          Конфликты знаний
          <Badge size="sm" variant="light" color="red">
            {total}
          </Badge>
        </>
      }
      size="xl"
      centered
      className={styles.modal}
      overlayProps={{ backgroundOpacity: 0.6, blur: 8 }}
    >
      <div className={styles.container}>
        {/* Navigation */}
        {total > 1 && (
          <div className={styles.nav}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={goPrev}
              disabled={currentIndex === 0}
            >
              <IconChevronLeft size={16} />
            </ActionIcon>
            <Text className={styles.navLabel}>
              {currentIndex + 1} из {total}
            </Text>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={goNext}
              disabled={currentIndex >= total - 1}
            >
              <IconChevronRight size={16} />
            </ActionIcon>
          </div>
        )}

        {/* Content */}
        <div className={styles.scrollArea}>
          {conflict && (
            <Stack gap={16}>
              {conflict.description && (
                <div className={styles.description}>
                  {conflict.description}
                </div>
              )}

              <div className={styles.comparisonGrid}>
                <NodeSide
                  label="Компания"
                  node={conflict.company_node}
                  variant="company"
                />
                <NodeSide
                  label="Рабочее пространство"
                  node={conflict.workspace_node}
                  variant="workspace"
                />
              </div>
            </Stack>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.dismissBtn}
            disabled={resolve.isPending}
            onClick={() => handleAction('dismissed')}
          >
            Отклонить
          </button>
          <button
            type="button"
            className={styles.resolveBtn}
            disabled={resolve.isPending}
            onClick={() => handleAction('resolved')}
          >
            {resolve.isPending ? 'Обработка...' : 'Разрешить'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
