'use client'

import dynamic from 'next/dynamic'
import { Drawer, Badge, Loader } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'

import type { KnowledgeNodeResponse } from '@/api/client/types.gen'
import { getNodeTypeConfig } from '@/lib/knowledge-utils'

import styles from './PublicNodeDrawer.module.css'

const TipTapEditor = dynamic(
  () => import('@/components/knowledge/TipTapEditor').then((m) => ({ default: m.TipTapEditor })),
  { ssr: false, loading: () => <Loader size="sm" /> },
)

interface PublicNodeDrawerProps {
  node: KnowledgeNodeResponse | null
  opened: boolean
  onClose: () => void
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Активный',
  draft: 'Черновик',
  archived: 'Архив',
  deprecated: 'Устаревший',
}

export function PublicNodeDrawer({ node, opened, onClose }: PublicNodeDrawerProps) {
  const isMobile = useMediaQuery('(max-width: 767px)')

  const typeConfig = node ? getNodeTypeConfig(node.node_type_def?.slug ?? 'note') : null
  const hasContent = node?.content && Object.keys(node.content).length > 0

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size={isMobile ? '100%' : 520}
      title={node?.title ?? ''}
      className={styles.drawer}
      overlayProps={{ backgroundOpacity: 0.4, blur: 4 }}
    >
      {node && (
        <>
          <div className={styles.meta}>
            {node.node_type_def && (
              <Badge
                size="sm"
                variant="light"
                color={node.node_type_def.color || typeConfig?.color}
              >
                {node.node_type_def.label}
              </Badge>
            )}
            <Badge size="sm" variant="dot" color="gray">
              {STATUS_LABELS[node.status ?? 'active'] ?? node.status}
            </Badge>
          </div>

          <div className={styles.content}>
            {hasContent ? (
              <TipTapEditor
                content={node.content as Record<string, unknown>}
                onChange={() => {}}
                editable={false}
                borderless
              />
            ) : (
              <div className={styles.empty}>Нет содержимого</div>
            )}
          </div>
        </>
      )}
    </Drawer>
  )
}
