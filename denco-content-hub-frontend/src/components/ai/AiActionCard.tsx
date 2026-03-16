'use client'

import { useState, useEffect } from 'react'
import { ActionIcon, Button, Text, Tooltip } from '@mantine/core'
import { IconCheck, IconX, IconPlus, IconEdit, IconArrowRight } from '@tabler/icons-react'
import { getNodeTypeConfig } from '@/lib/knowledge-utils'
import type { AiAction } from '@/hooks/useAiChat'
import styles from './AiActionCard.module.css'

interface AiActionCardProps {
  action: AiAction
  onApply: () => Promise<boolean>
  onReject: () => void
}

function getActionIcon(actionType: string) {
  switch (actionType) {
    case 'create_node':
      return IconPlus
    case 'update_node':
      return IconEdit
    case 'create_edge':
      return IconArrowRight
    default:
      return IconPlus
  }
}

function getActionLabel(action: AiAction): string {
  switch (action.action_type) {
    case 'create_node': {
      const nodeType = action.payload.node_type as string
      const config = getNodeTypeConfig(nodeType)
      return `Создать: ${config.label}`
    }
    case 'update_node':
      return 'Обновить узел'
    case 'create_edge':
      return `Связь: ${action.payload.label as string}`
    default:
      return 'Действие'
  }
}

function getApplyButtonLabel(actionType: string): string {
  switch (actionType) {
    case 'create_node':
      return 'Создать'
    case 'update_node':
      return 'Применить'
    case 'create_edge':
      return 'Связать'
    default:
      return 'Применить'
  }
}

function getActionColor(action: AiAction): string {
  if (action.action_type === 'create_node') {
    return getNodeTypeConfig(action.payload.node_type as string).color
  }
  if (action.action_type === 'create_edge') return '#30D158'
  return '#0A84FF'
}

export function AiActionCard({ action, onApply, onReject }: AiActionCardProps) {
  console.log('[AiActionCard] RENDER, action:', action.id, action.action_type)
  const [loading, setLoading] = useState(false)
  const [flashing, setFlashing] = useState(false)
  const ActionTypeIcon = getActionIcon(action.action_type)
  const color = getActionColor(action)
  const title = (action.payload.title as string) ?? (action.payload.label as string) ?? ''
  const content = action.payload.content as string | undefined

  useEffect(() => {
    console.log('[AiActionCard] flashing changed:', flashing)
    if (!flashing) return
    const timer = setTimeout(() => setFlashing(false), 1500)
    return () => clearTimeout(timer)
  }, [flashing])

  const handleApply = async () => {
    setLoading(true)
    try {
      const success = await onApply()
      console.log('[AiActionCard] onApply returned:', success, 'type:', typeof success)
      if (success) {
        console.log('[AiActionCard] Setting flashing=true')
        setFlashing(true)
      }
    } finally {
      setLoading(false)
    }
  }

  const isResolved = action.status === 'applied' || action.status === 'rejected'

  return (
    <div
      className={styles.card}
      style={Object.assign(
        { '--action-color': color } as React.CSSProperties,
        flashing
          ? { background: 'rgba(48, 209, 88, 0.3)', borderColor: '#30D158', transition: 'background 1.5s ease-out, border-color 1.5s ease-out' }
          : { transition: 'background 1.5s ease-out, border-color 1.5s ease-out' },
      )}
    >
      <div className={styles.header}>
        <div className={styles.iconWrap} style={{ background: color }}>
          <ActionTypeIcon size={14} color="#fff" />
        </div>
        <div className={styles.meta}>
          <Text size="xs" fw={600} c="gray.2">
            {getActionLabel(action)}
          </Text>
          {title && (
            <Text size="xs" c="dimmed" lineClamp={1}>
              {title}
            </Text>
          )}
        </div>
        {!isResolved && (
          <div className={styles.actions}>
            <Tooltip
              label={
                <>
                  <Text fw={600} size="xs">{title || getActionLabel(action)}</Text>
                  {content && (
                    <Text size="xs" c="dimmed" mt={4}>
                      {content.length > 150 ? content.slice(0, 150) + '…' : content}
                    </Text>
                  )}
                </>
              }
              position="top"
              withArrow
              multiline
              w={300}
              openDelay={400}
            >
              <Button
                variant="light"
                color="teal"
                size="compact-xs"
                leftSection={<IconCheck size={14} />}
                loading={loading}
                onClick={handleApply}
              >
                {getApplyButtonLabel(action.action_type)}
              </Button>
            </Tooltip>
            <Tooltip label="Отклонить" position="top" withArrow>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={onReject}
                disabled={loading}
                aria-label="Отклонить"
              >
                <IconX size={14} />
              </ActionIcon>
            </Tooltip>
          </div>
        )}
        {action.status === 'applied' && (
          <div className={styles.statusBadge} data-status="applied">
            <IconCheck size={12} /> Применено
          </div>
        )}
        {action.status === 'rejected' && (
          <div className={styles.statusBadge} data-status="rejected">
            <IconX size={12} /> Отклонено
          </div>
        )}
      </div>
      {content && !isResolved && (
        <Text size="xs" c="dimmed" className={styles.preview} lineClamp={3}>
          {content}
        </Text>
      )}
    </div>
  )
}
