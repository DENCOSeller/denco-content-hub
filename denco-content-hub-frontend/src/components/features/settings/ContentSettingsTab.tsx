'use client'

import { useState } from 'react'
import { SegmentedControl, Stack, Text } from '@mantine/core'

import { NodeTypeManager } from './NodeTypeManager'

type NodeType = 'speaker' | 'content_goal' | 'narrative_format' | 'hook_type' | 'tone_of_voice' | 'product_focus'

const NODE_TYPE_OPTIONS: { value: NodeType; label: string }[] = [
  { value: 'speaker', label: 'Спикеры' },
  { value: 'content_goal', label: 'Цели контента' },
  { value: 'narrative_format', label: 'Нарративы' },
  { value: 'hook_type', label: 'Хуки' },
  { value: 'tone_of_voice', label: 'Тональность' },
  { value: 'product_focus', label: 'Продукты' },
]

const NODE_TYPE_DESCRIPTIONS: Record<NodeType, string> = {
  speaker: 'Управление спикерами и ведущими контента',
  content_goal: 'Цели и задачи создаваемого контента',
  narrative_format: 'Форматы повествования и подачи',
  hook_type: 'Типы привлечения внимания в начале',
  tone_of_voice: 'Тональность и стиль коммуникации',
  product_focus: 'Продукты и услуги для продвижения',
}

interface ContentSettingsTabProps {
  workspaceId: number
}

export function ContentSettingsTab({ workspaceId }: ContentSettingsTabProps) {
  const [activeType, setActiveType] = useState<NodeType>('speaker')

  const activeOption = NODE_TYPE_OPTIONS.find((o) => o.value === activeType)

  return (
    <Stack gap="md">
      <SegmentedControl
        value={activeType}
        onChange={(val) => setActiveType(val as NodeType)}
        data={NODE_TYPE_OPTIONS}
        fullWidth
      />

      <Text size="xs" c="var(--text-secondary)">
        {NODE_TYPE_DESCRIPTIONS[activeType]}
      </Text>

      <NodeTypeManager
        key={activeType}
        workspaceId={workspaceId}
        nodeType={activeType}
        nodeLabel={activeOption?.label ?? ''}
      />
    </Stack>
  )
}
