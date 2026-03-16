'use client'

import { useState } from 'react'
import {
  Stack,
  Group,
  Text,
  Button,
  Table,
  ActionIcon,
  Tooltip,
  Card,
  Modal,
  Alert,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconEdit, IconTrash, IconPlus, IconAlertTriangle } from '@tabler/icons-react'

import {
  useKnowledgeNodesByType,
  useDeleteNodeMutation,
} from '@/api/hooks/useKnowledge'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { EmptyState } from '@/components/shared/EmptyState'
import { NodeFormModal } from './NodeFormModal'
import { SpeakerFormModal } from './SpeakerFormModal'
import { SpeakerCards } from './SpeakerCards'
import type { NodeType, KnowledgeNodeResponse } from '@/api/client/types.gen'

interface NodeTypeManagerProps {
  workspaceId: number
  nodeType: NodeType
  nodeLabel: string
}

export function NodeTypeManager({ workspaceId, nodeType, nodeLabel }: NodeTypeManagerProps) {
  const { data, isLoading, isError, refetch } = useKnowledgeNodesByType(workspaceId, nodeType)
  const deleteNode = useDeleteNodeMutation(workspaceId)

  const isSpeaker = nodeType === 'speaker'

  const [formOpened, setFormOpened] = useState(false)
  const [editingNode, setEditingNode] = useState<{ id: number; title: string; content_text: string } | null>(null)
  const [editingSpeaker, setEditingSpeaker] = useState<KnowledgeNodeResponse | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeNodeResponse | null>(null)

  const handleEdit = (node: KnowledgeNodeResponse) => {
    if (isSpeaker) {
      setEditingSpeaker(node)
      setFormOpened(true)
    } else {
      setEditingNode({ id: node.id, title: node.title, content_text: node.content_text ?? '' })
      setFormOpened(true)
    }
  }

  const handleCreate = () => {
    setEditingNode(null)
    setEditingSpeaker(null)
    setFormOpened(true)
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    deleteNode.mutate(deleteTarget.id, {
      onSuccess: () => {
        notifications.show({ title: 'Удалено', message: `${deleteTarget.title} удалён`, color: 'green' })
        setDeleteTarget(null)
      },
      onError: () => {
        notifications.show({ title: 'Ошибка', message: 'Не удалось удалить', color: 'red' })
        setDeleteTarget(null)
      },
    })
  }

  if (isLoading) return <LoadingState />
  if (isError) return <ErrorState onRetry={refetch} />

  const nodes = data ?? []

  return (
    <>
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={500} c="gray.2">
            {nodeLabel} ({nodes.length})
          </Text>
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={handleCreate}
          >
            Добавить
          </Button>
        </Group>

        {nodes.length === 0 ? (
          <EmptyState message={`Нет элементов типа "${nodeLabel}"`} />
        ) : isSpeaker ? (
          <SpeakerCards
            nodes={nodes}
            onEdit={handleEdit}
            onDelete={setDeleteTarget}
          />
        ) : (
          <Card
            padding={0}
            radius="md"
            withBorder
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--card-bg)' }}
          >
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Название</Table.Th>
                  <Table.Th>Описание</Table.Th>
                  <Table.Th style={{ width: 120 }}>Использований</Table.Th>
                  <Table.Th style={{ width: 80 }}>Действия</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {nodes.map((node) => (
                  <Table.Tr key={node.id}>
                    <Table.Td>
                      <Text size="sm" c="gray.2" fw={500}>{node.title}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed" lineClamp={1}>
                        {node.content_text
                          ? node.content_text.length > 100
                            ? `${node.content_text.slice(0, 100)}…`
                            : node.content_text
                          : '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c={node.usage_count ? 'gray.2' : 'dimmed'}>
                        {node.usage_count ?? 0}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Tooltip label="Редактировать">
                          <ActionIcon variant="subtle" size="sm" onClick={() => handleEdit(node)}>
                            <IconEdit size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Удалить">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            size="sm"
                            onClick={() => setDeleteTarget(node)}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>
        )}
      </Stack>

      {isSpeaker ? (
        <SpeakerFormModal
          workspaceId={workspaceId}
          opened={formOpened}
          onClose={() => {
            setFormOpened(false)
            setEditingSpeaker(null)
          }}
          editingNode={editingSpeaker}
        />
      ) : (
        <NodeFormModal
          workspaceId={workspaceId}
          nodeType={nodeType}
          nodeLabel={nodeLabel}
          opened={formOpened}
          onClose={() => {
            setFormOpened(false)
            setEditingNode(null)
          }}
          editingNode={editingNode}
        />
      )}

      <Modal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Подтверждение удаления"
        centered
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            Удалить <Text span fw={600}>«{deleteTarget?.title}»</Text>?
          </Text>
          {deleteTarget && (deleteTarget.usage_count ?? 0) > 0 && (
            <Alert
              icon={<IconAlertTriangle size={16} />}
              color="orange"
              variant="light"
            >
              <Text size="sm">
                Этот узел используется в {deleteTarget.usage_count} контент-единицах. При удалении связь будет потеряна.
              </Text>
            </Alert>
          )}
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setDeleteTarget(null)}>Отмена</Button>
            <Button color="red" loading={deleteNode.isPending} onClick={handleDelete}>
              Удалить
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
