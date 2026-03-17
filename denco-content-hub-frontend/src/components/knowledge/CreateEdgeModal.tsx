'use client'

import { useState } from 'react'
import { Modal, TextInput, Select, Stack, Group, Button, Loader } from '@mantine/core'

import { useCreateEdgeMutation } from '@/api/hooks/useKnowledge'
import { useCompanyCreateEdgeMutation } from '@/api/hooks/useCompanyKnowledge'
import { useEdgeTypeDefs } from '@/api/hooks/useKgTypes'
import { useCompanyStore } from '@/stores/company-store'
import type { KnowledgeScope } from '@/hooks/useKnowledgeGraph'

const FALLBACK_EDGE_TYPES = [
  { value: 'relates_to', label: 'Связано с' },
  { value: 'depends_on', label: 'Зависит от' },
  { value: 'implements', label: 'Реализует' },
  { value: 'contradicts', label: 'Противоречит' },
  { value: 'supports', label: 'Поддерживает' },
  { value: 'derived_from', label: 'Производное от' },
  { value: 'part_of', label: 'Часть' },
  { value: 'causes', label: 'Вызывает' },
  { value: 'similar_to', label: 'Похоже на' },
  { value: 'references', label: 'Ссылается на' },
]

interface CreateEdgeModalProps {
  scope: KnowledgeScope
  scopeId: number
  sourceNodeId: number | null
  targetNodeId: number | null
  opened: boolean
  onClose: () => void
}

export function CreateEdgeModal({
  scope,
  scopeId,
  sourceNodeId,
  targetNodeId,
  opened,
  onClose,
}: CreateEdgeModalProps) {
  const [label, setLabel] = useState('')
  const [edgeTypeDefId, setEdgeTypeDefId] = useState<string | null>(null)

  const activeCompany = useCompanyStore((s) => s.activeCompany)
  const companyId = scope === 'company' ? scopeId : (activeCompany?.id ?? 0)

  const { data: edgeTypeDefs, isLoading: isTypesLoading } = useEdgeTypeDefs(companyId)

  const isApiLoaded = !!edgeTypeDefs
  const typeOptions = edgeTypeDefs?.filter((t) => t.is_active).map((t) => ({
    value: String(t.id),
    label: t.label,
  })) ?? FALLBACK_EDGE_TYPES

  const workspaceCreate = useCreateEdgeMutation(scope === 'workspace' ? scopeId : 0)
  const companyCreate = useCompanyCreateEdgeMutation(scope === 'company' ? scopeId : 0)
  const createEdge = scope === 'workspace' ? workspaceCreate : companyCreate

  const handleClose = () => {
    setLabel('')
    setEdgeTypeDefId(null)
    createEdge.reset()
    onClose()
  }

  const handleTypeChange = (value: string | null) => {
    setEdgeTypeDefId(value)
    if (value && edgeTypeDefs) {
      const selected = edgeTypeDefs.find((t) => String(t.id) === value)
      if (selected && !label.trim()) {
        setLabel(selected.label)
      }
    }
  }

  const handleSubmit = () => {
    if (!sourceNodeId || !targetNodeId || !label.trim()) return

    createEdge.mutate(
      {
        source_node_id: sourceNodeId,
        target_node_id: targetNodeId,
        label: label.trim(),
        edge_type_def_id: edgeTypeDefId && isApiLoaded ? Number(edgeTypeDefId) : undefined,
      },
      { onSuccess: handleClose },
    )
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Новая связь" centered size="sm">
      <Stack gap="md">
        <Select
          label="Тип связи"
          placeholder="Выберите тип связи"
          data={typeOptions}
          value={edgeTypeDefId}
          onChange={handleTypeChange}
          searchable
          clearable
          rightSection={isTypesLoading ? <Loader size={16} /> : undefined}
          data-autofocus
        />

        <TextInput
          label="Название связи"
          placeholder="например: влияет на"
          value={label}
          onChange={(e) => setLabel(e.currentTarget.value)}
        />

        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" color="gray" onClick={handleClose}>
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            loading={createEdge.isPending}
            disabled={!label.trim() || !sourceNodeId || !targetNodeId}
          >
            Создать
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
