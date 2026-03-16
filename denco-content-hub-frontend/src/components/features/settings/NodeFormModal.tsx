'use client'

import { useEffect } from 'react'
import { Modal, TextInput, Textarea, Button, Group, Stack } from '@mantine/core'
import { useForm } from '@mantine/form'
import { zodResolver } from 'mantine-form-zod-resolver'
import { notifications } from '@mantine/notifications'
import { z } from 'zod'

import { useCreateNodeMutation, useUpdateNodeMutation } from '@/api/hooks/useKnowledge'
import type { NodeType } from '@/api/client/types.gen'

const nodeFormSchema = z.object({
  title: z.string().min(1, 'Название обязательно'),
  contentText: z.string().min(1, 'Описание обязательно'),
})

type NodeFormValues = z.infer<typeof nodeFormSchema>

interface EditingNode {
  id: number
  title: string
  content_text: string
}

interface NodeFormModalProps {
  workspaceId: number
  nodeType: NodeType
  nodeLabel: string
  opened: boolean
  onClose: () => void
  editingNode?: EditingNode | null
}

function buildContent(text: string): Record<string, unknown> {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  }
}

export function NodeFormModal({
  workspaceId,
  nodeType,
  nodeLabel,
  opened,
  onClose,
  editingNode,
}: NodeFormModalProps) {
  const createNode = useCreateNodeMutation(workspaceId)
  const updateNode = useUpdateNodeMutation(workspaceId)

  const form = useForm<NodeFormValues>({
    mode: 'uncontrolled',
    initialValues: { title: '', contentText: '' },
    validate: zodResolver(nodeFormSchema),
  })

  useEffect(() => {
    if (opened) {
      if (editingNode) {
        form.setValues({
          title: editingNode.title,
          contentText: editingNode.content_text,
        })
      } else {
        form.reset()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, editingNode])

  const isEditing = !!editingNode
  const isPending = createNode.isPending || updateNode.isPending

  const handleSubmit = form.onSubmit((values) => {
    const content = buildContent(values.contentText)

    if (isEditing) {
      updateNode.mutate(
        { nodeId: editingNode.id, data: { title: values.title, content } },
        {
          onSuccess: () => {
            notifications.show({ title: 'Сохранено', message: `${nodeLabel} обновлён`, color: 'green' })
            onClose()
          },
          onError: () => {
            notifications.show({ title: 'Ошибка', message: 'Не удалось сохранить', color: 'red' })
          },
        },
      )
    } else {
      createNode.mutate(
        { node_type: nodeType, title: values.title, content },
        {
          onSuccess: () => {
            notifications.show({ title: 'Создано', message: `${nodeLabel} добавлен`, color: 'green' })
            onClose()
          },
          onError: () => {
            notifications.show({ title: 'Ошибка', message: 'Не удалось создать', color: 'red' })
          },
        },
      )
    }
  })

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEditing ? `Редактировать: ${nodeLabel}` : `Добавить: ${nodeLabel}`}
      centered
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label="Название"
            placeholder="Введите название"
            key={form.key('title')}
            {...form.getInputProps('title')}
          />
          <Textarea
            label="Описание / Правила для AI"
            placeholder="Введите описание или правила"
            minRows={4}
            autosize
            maxRows={8}
            key={form.key('contentText')}
            {...form.getInputProps('contentText')}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={onClose}>Отмена</Button>
            <Button type="submit" loading={isPending}>
              {isEditing ? 'Сохранить' : 'Создать'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
