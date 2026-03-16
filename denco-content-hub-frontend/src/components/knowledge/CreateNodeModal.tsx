'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import {
  Modal,
  TextInput,
  Text,
  Stack,
  Loader,
  UnstyledButton,
} from '@mantine/core'

import { NODE_TYPE_CONFIG, type NodeType } from '@/lib/knowledge-utils'
import { useCreateNodeMutation } from '@/api/hooks/useKnowledge'
import { useCompanyCreateNodeMutation } from '@/api/hooks/useCompanyKnowledge'
import type { KnowledgeScope } from '@/hooks/useKnowledgeGraph'

import styles from './CreateNodeModal.module.css'

const TipTapEditor = dynamic(
  () => import('./TipTapEditor').then((m) => ({ default: m.TipTapEditor })),
  { ssr: false, loading: () => <Loader size="sm" /> },
)

interface CreateNodeModalProps {
  scope: KnowledgeScope
  scopeId: number
  opened: boolean
  onClose: () => void
}

const NODE_TYPES = Object.entries(NODE_TYPE_CONFIG) as [NodeType, (typeof NODE_TYPE_CONFIG)[NodeType]][]

/* Convert hex #RRGGBB to "R, G, B" for rgba() usage */
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const n = parseInt(h, 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

export function CreateNodeModal({ scope, scopeId, opened, onClose }: CreateNodeModalProps) {
  const [selectedType, setSelectedType] = useState<NodeType>('note')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState<Record<string, unknown> | null>(null)

  const workspaceCreate = useCreateNodeMutation(scope === 'workspace' ? scopeId : 0)
  const companyCreate = useCompanyCreateNodeMutation(scope === 'company' ? scopeId : 0)
  const createNode = scope === 'workspace' ? workspaceCreate : companyCreate

  const selectedConfig = NODE_TYPE_CONFIG[selectedType]

  const reset = () => {
    setSelectedType('note')
    setTitle('')
    setContent(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleContentChange = useCallback((json: Record<string, unknown>) => {
    setContent(json)
  }, [])

  const handleSubmit = () => {
    if (!title.trim()) return
    createNode.mutate(
      {
        node_type: selectedType,
        title: title.trim(),
        content: content ?? undefined,
      },
      { onSuccess: handleClose },
    )
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Создать узел"
      size="xl"
      centered
      className={styles.modal}
      overlayProps={{ backgroundOpacity: 0.6, blur: 8 }}
    >
      <div className={styles.container}>
        {/* Scrollable content */}
        <div className={styles.scrollArea}>
          <Stack gap={24}>
            {/* Type label */}
            <Text className={styles.sectionLabel}>Тип узла</Text>

            {/* Type picker */}
            <div className={styles.typeGrid}>
              {NODE_TYPES.map(([type, config]) => {
                const Icon = config.icon
                const isSelected = selectedType === type
                const cssVars = {
                  '--type-color': config.color,
                  '--type-color-rgb': hexToRgb(config.color),
                } as React.CSSProperties

                return (
                  <UnstyledButton
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`${styles.typeCard} ${isSelected ? styles.typeCardSelected : ''}`}
                    style={cssVars}
                  >
                    <div className={styles.typeIcon} style={{ background: config.gradient }}>
                      <Icon size={20} color="#fff" stroke={1.8} />
                    </div>
                    <span className={`${styles.typeLabel} ${isSelected ? styles.typeLabelSelected : ''}`}>
                      {config.label}
                    </span>
                  </UnstyledButton>
                )
              })}
            </div>

            {/* Title */}
            <TextInput
              placeholder="Название узла"
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
              data-autofocus
              className={styles.titleInput}
              variant="unstyled"
            />

            {/* Editor */}
            <div>
              <Text className={styles.sectionLabel} mb={8}>Содержание</Text>
              <div className={styles.editorWrapper}>
                <TipTapEditor
                  content={content}
                  onChange={handleContentChange}
                  accentGradient={selectedConfig.gradient}
                  placeholder="Начните описывать узел..."
                />
              </div>
            </div>
          </Stack>
        </div>

        {/* Sticky footer */}
        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={handleClose}>
            Отмена
          </button>
          <button
            type="button"
            className={styles.submitBtn}
            disabled={!title.trim() || createNode.isPending}
            onClick={handleSubmit}
            style={{ background: selectedConfig.gradient }}
          >
            {createNode.isPending ? 'Создание...' : 'Создать узел'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
