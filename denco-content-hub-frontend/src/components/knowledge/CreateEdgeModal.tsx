'use client'

import { useState } from 'react'
import { Modal, TextInput, Stack, Group, Button } from '@mantine/core'

import { useCreateEdgeMutation } from '@/api/hooks/useKnowledge'
import { useCompanyCreateEdgeMutation } from '@/api/hooks/useCompanyKnowledge'
import type { KnowledgeScope } from '@/hooks/useKnowledgeGraph'

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

  const workspaceCreate = useCreateEdgeMutation(scope === 'workspace' ? scopeId : 0)
  const companyCreate = useCompanyCreateEdgeMutation(scope === 'company' ? scopeId : 0)
  const createEdge = scope === 'workspace' ? workspaceCreate : companyCreate

  const handleClose = () => {
    setLabel('')
    createEdge.reset()
    onClose()
  }

  const handleSubmit = () => {
    if (!sourceNodeId || !targetNodeId || !label.trim()) return

    createEdge.mutate(
      {
        source_node_id: sourceNodeId,
        target_node_id: targetNodeId,
        label: label.trim(),
      },
      { onSuccess: handleClose },
    )
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Новая связь" centered size="sm">
      <Stack gap="md">
        <TextInput
          label="Название связи"
          placeholder="например: влияет на"
          value={label}
          onChange={(e) => setLabel(e.currentTarget.value)}
          data-autofocus
        />

        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" color="gray" onClick={handleClose}>
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            loading={createEdge.isPending}
            disabled={!label.trim()}
          >
            Создать
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
