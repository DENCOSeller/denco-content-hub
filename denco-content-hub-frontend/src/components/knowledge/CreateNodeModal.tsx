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
  Select,
  Textarea,
} from '@mantine/core'

import type { NodeType } from '@/lib/knowledge-utils'
import { useCreateNodeMutation } from '@/api/hooks/useKnowledge'
import { useCompanyCreateNodeMutation } from '@/api/hooks/useCompanyKnowledge'
import type { KnowledgeScope } from '@/hooks/useKnowledgeGraph'
import { useNodeTypeConfig } from '@/hooks/useNodeTypeConfig'
import { useCompanyStore } from '@/stores/company-store'

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

const SPEAKER_STYLE_OPTIONS = [
  { value: 'expert', label: 'Экспертный' },
  { value: 'lively', label: 'Живой' },
  { value: 'provocative', label: 'Провокационный' },
  { value: 'motivational', label: 'Мотивационный' },
  { value: 'analytical', label: 'Аналитический' },
  { value: 'conversational', label: 'Разговорный' },
]

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

  const activeCompany = useCompanyStore((s) => s.activeCompany)
  const companyId = scope === 'company' ? scopeId : (activeCompany?.id ?? 0)
  const { config, getConfig, getTypeDefId, isLoading: isTypesLoading } = useNodeTypeConfig(companyId)

  const nodeTypes = Object.entries(config) as [NodeType, (typeof config)[string]][]

  const workspaceCreate = useCreateNodeMutation(scope === 'workspace' ? scopeId : 0)
  const companyCreate = useCompanyCreateNodeMutation(scope === 'company' ? scopeId : 0)
  const createNode = scope === 'workspace' ? workspaceCreate : companyCreate

  const selectedConfig = getConfig(selectedType)

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

  const handleSpeakerFieldChange = useCallback(
    (field: string, value: string | null) => {
      setContent((prev) => ({ ...(prev ?? {}), [field]: value ?? '' }))
    },
    [],
  )

  const handleSubmit = () => {
    if (!title.trim()) return
    const typeDefId = getTypeDefId(selectedType)
    createNode.mutate(
      {
        node_type_def_id: typeDefId,
        title: title.trim(),
        content: content ?? undefined,
      } as never,
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
              {isTypesLoading && <Loader size="sm" />}
              {nodeTypes.map(([type, cfg]) => {
                const Icon = cfg.icon
                const isSelected = selectedType === type
                const cssVars = {
                  '--type-color': cfg.color,
                  '--type-color-rgb': hexToRgb(cfg.color),
                } as React.CSSProperties

                return (
                  <UnstyledButton
                    key={type}
                    onClick={() => { setSelectedType(type as NodeType); setContent(null) }}
                    className={`${styles.typeCard} ${isSelected ? styles.typeCardSelected : ''}`}
                    style={cssVars}
                  >
                    <div className={styles.typeIcon} style={{ background: cfg.gradient }}>
                      <Icon size={20} color="#fff" stroke={1.8} />
                    </div>
                    <span className={`${styles.typeLabel} ${isSelected ? styles.typeLabelSelected : ''}`}>
                      {cfg.label}
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

            {/* Editor / Speaker fields */}
            {selectedType === 'speaker' ? (
              <Stack gap="md">
                <TextInput
                  label="Должность"
                  placeholder="Например: CEO, Маркетолог"
                  value={(content?.position as string) ?? ''}
                  onChange={(e) => handleSpeakerFieldChange('position', e.currentTarget.value)}
                />
                <Select
                  label="Стиль подачи"
                  placeholder="Выберите стиль"
                  data={SPEAKER_STYLE_OPTIONS}
                  value={(content?.style as string) ?? null}
                  onChange={(val) => handleSpeakerFieldChange('style', val)}
                  clearable
                />
                <Textarea
                  label="Особенности"
                  placeholder="Особенности спикера для написания сценариев..."
                  autosize
                  minRows={3}
                  maxRows={6}
                  value={(content?.notes as string) ?? ''}
                  onChange={(e) => handleSpeakerFieldChange('notes', e.currentTarget.value)}
                />
                <Textarea
                  label="Описание для AI"
                  placeholder="Инструкция для AI при генерации контента..."
                  autosize
                  minRows={3}
                  maxRows={6}
                  value={(content?.ai_description as string) ?? ''}
                  onChange={(e) => handleSpeakerFieldChange('ai_description', e.currentTarget.value)}
                />
                <TextInput
                  label="Фото URL"
                  placeholder="https://example.com/photo.jpg"
                  value={(content?.photo_url as string) ?? ''}
                  onChange={(e) => handleSpeakerFieldChange('photo_url', e.currentTarget.value)}
                />
              </Stack>
            ) : (
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
            )}
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
