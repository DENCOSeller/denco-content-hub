'use client'

import { useState } from 'react'
import { SegmentedControl, Stack } from '@mantine/core'

import { NodeTypeManager } from './NodeTypeManager'
import type { NodeType } from '@/api/client/types.gen'

const NODE_TYPE_OPTIONS: { value: NodeType; label: string }[] = [
  { value: 'speaker', label: 'Спикеры' },
  { value: 'content_goal', label: 'Цели контента' },
  { value: 'narrative_format', label: 'Нарративы' },
  { value: 'hook_type', label: 'Хуки' },
  { value: 'tone_of_voice', label: 'Тональность' },
  { value: 'product_focus', label: 'Продукты' },
]

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

      <NodeTypeManager
        key={activeType}
        workspaceId={workspaceId}
        nodeType={activeType}
        nodeLabel={activeOption?.label ?? ''}
      />
    </Stack>
  )
}
