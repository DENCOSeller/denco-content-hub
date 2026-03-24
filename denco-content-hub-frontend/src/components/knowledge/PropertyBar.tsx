'use client'

import { useState } from 'react'
import {
  Popover,
  Select,
  Slider,
  TextInput,
  Collapse,
  Text,
} from '@mantine/core'
import { IconLink, IconExternalLink } from '@tabler/icons-react'

import { getNodeTypeConfig } from '@/lib/knowledge-utils'
import styles from './PropertyBar.module.css'

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  draft: 'Draft',
  deprecated: 'Deprecated',
  archived: 'Archived',
}

const STATUS_DOT: Record<string, string> = {
  active: styles.statusActive,
  draft: styles.statusDraft,
  deprecated: styles.statusDeprecated,
  archived: styles.statusArchived,
}

interface ConnectedNode {
  edgeId: number
  nodeId: number
  title: string
  nodeType: string
  label: string
  direction: 'outgoing' | 'incoming'
}

interface PropertyBarProps {
  status: string
  confidence: number
  ownerRole: string | null | undefined
  source: string
  lastReviewed: string | null | undefined
  connectedNodes: ConnectedNode[]
  onStatusChange: (val: string) => void
  onConfidenceChange: (val: number) => void
  onConfidenceChangeEnd: (val: number) => void
  onSourceChange: (val: string) => void
  onNavigateToNode: (nodeId: number) => void
}

export function PropertyBar({
  status,
  confidence,
  ownerRole,
  source,
  lastReviewed,
  connectedNodes,
  onStatusChange,
  onConfidenceChange,
  onConfidenceChangeEnd,
  onSourceChange,
  onNavigateToNode,
}: PropertyBarProps) {
  const [relationsOpen, setRelationsOpen] = useState(false)

  const reviewedText = lastReviewed
    ? new Date(lastReviewed).toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'short',
      })
    : null

  const ownerText = ownerRole === 'company' ? 'Company' : 'Workspace'

  const truncatedSource = source
    ? source.length > 24
      ? `${source.slice(0, 24)}…`
      : source
    : null

  return (
    <>
      <div className={styles.propertyBar}>
        {/* Status */}
        <Popover width={180} position="bottom-start" shadow="md" withinPortal transitionProps={{ transition: 'pop', duration: 150 }}>
          <Popover.Target>
            <button type="button" className={styles.chip}>
              <span className={`${styles.statusDot} ${STATUS_DOT[status] ?? STATUS_DOT.active}`} />
              <span>{STATUS_LABELS[status] ?? status}</span>
            </button>
          </Popover.Target>
          <Popover.Dropdown className={styles.popoverDropdown}>
            <Select
              size="xs"
              value={status}
              onChange={(val) => { if (val) onStatusChange(val) }}
              data={[
                { value: 'active', label: 'Активный' },
                { value: 'draft', label: 'Черновик' },
                { value: 'deprecated', label: 'Устаревший' },
                { value: 'archived', label: 'Архив' },
              ]}
              variant="unstyled"
              comboboxProps={{ withinPortal: false }}
            />
          </Popover.Dropdown>
        </Popover>

        <div className={styles.divider} />

        {/* Confidence */}
        <Popover width={200} position="bottom-start" shadow="md" withinPortal transitionProps={{ transition: 'pop', duration: 150 }}>
          <Popover.Target>
            <button type="button" className={styles.chip}>
              {Math.round(confidence * 100)}%
            </button>
          </Popover.Target>
          <Popover.Dropdown className={styles.popoverDropdown}>
            <Text size="xs" c="dimmed" mb={4}>Уверенность</Text>
            <Slider
              size="xs"
              min={0}
              max={1}
              step={0.05}
              value={confidence}
              onChange={onConfidenceChange}
              onChangeEnd={onConfidenceChangeEnd}
              label={(val) => `${Math.round(val * 100)}%`}
            />
          </Popover.Dropdown>
        </Popover>

        <div className={styles.divider} />

        {/* Owner (read-only) */}
        <span className={`${styles.chip} ${styles.chipReadonly}`}>
          {ownerText}
        </span>

        <div className={styles.divider} />

        {/* Relations */}
        <button
          type="button"
          className={`${styles.chip} ${connectedNodes.length === 0 ? styles.chipDimmed : ''}`}
          onClick={connectedNodes.length > 0 ? () => setRelationsOpen((v) => !v) : undefined}
        >
          <IconLink size={12} stroke={1.5} />
          <span>{connectedNodes.length} {connectedNodes.length === 1 ? 'связь' : connectedNodes.length >= 2 && connectedNodes.length <= 4 ? 'связи' : 'связей'}</span>
        </button>

        <div className={styles.divider} />

        {/* Source */}
        <Popover width={260} position="bottom-start" shadow="md" withinPortal transitionProps={{ transition: 'pop', duration: 150 }}>
          <Popover.Target>
            <button type="button" className={styles.chip}>
              <IconExternalLink size={12} stroke={1.5} />
              <span>{truncatedSource ?? 'Добавить источник'}</span>
            </button>
          </Popover.Target>
          <Popover.Dropdown className={styles.popoverDropdown}>
            <TextInput
              size="xs"
              placeholder="URL или описание источника"
              value={source}
              onChange={(e) => onSourceChange(e.currentTarget.value)}
              variant="unstyled"
              styles={{ input: { color: 'var(--text-primary, #f0f0ff)', fontSize: 12 } }}
            />
          </Popover.Dropdown>
        </Popover>

        {/* Last Reviewed (read-only) */}
        {reviewedText && (
          <>
            <div className={styles.divider} />
            <span className={`${styles.chip} ${styles.chipReadonly}`}>
              {reviewedText}
            </span>
          </>
        )}
      </div>

      {/* Relations Collapse */}
      <Collapse in={relationsOpen} transitionDuration={200} transitionTimingFunction="ease">
        <div className={styles.relationsCollapse}>
          <div className={styles.relationsCollapseInner}>
            {connectedNodes.map((rel) => {
              const relConfig = getNodeTypeConfig(rel.nodeType)
              const RelIcon = relConfig.icon
              return (
                <button
                  key={rel.edgeId}
                  type="button"
                  className={styles.relationRow}
                  onClick={() => onNavigateToNode(rel.nodeId)}
                >
                  <RelIcon size={14} color={relConfig.color} stroke={1.8} />
                  <span className={styles.relationTitle}>{rel.title}</span>
                  <span className={styles.relationLabel}>{rel.label}</span>
                </button>
              )
            })}
            {connectedNodes.length === 0 && (
              <Text size="xs" c="dimmed" ta="center" py={8}>
                Нет связей
              </Text>
            )}
          </div>
        </div>
      </Collapse>
    </>
  )
}
