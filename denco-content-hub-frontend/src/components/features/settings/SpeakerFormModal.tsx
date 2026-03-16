'use client'

import { useEffect } from 'react'
import { Modal, TextInput, Textarea, Button, Group, Stack, Select } from '@mantine/core'
import { useForm } from '@mantine/form'
import { zodResolver } from 'mantine-form-zod-resolver'
import { notifications } from '@mantine/notifications'
import { z } from 'zod'

import { useCreateNodeMutation, useUpdateNodeMutation } from '@/api/hooks/useKnowledge'
import type { KnowledgeNodeResponse } from '@/api/client/types.gen'

const speakerSchema = z.object({
  title: z.string().min(1, 'Имя спикера обязательно'),
  position: z.string(),
  style: z.string(),
  notes: z.string(),
  photoUrl: z.string(),
  aiDescription: z.string(),
})

type SpeakerFormValues = z.infer<typeof speakerSchema>

const STYLE_OPTIONS = [
  'Экспертный',
  'Живой',
  'Провокационный',
  'Мотивационный',
  'Аналитический',
  'Разговорный',
]

interface SpeakerContent {
  position?: string
  style?: string
  notes?: string
  photo_url?: string
  ai_description?: string
}

interface SpeakerFormModalProps {
  workspaceId: number
  opened: boolean
  onClose: () => void
  editingNode?: KnowledgeNodeResponse | null
}

function parseSpeakerContent(node: KnowledgeNodeResponse | null | undefined): SpeakerContent {
  if (!node?.content) return {}
  const c = node.content as SpeakerContent
  return {
    position: c.position ?? '',
    style: c.style ?? '',
    notes: c.notes ?? '',
    photo_url: c.photo_url ?? '',
    ai_description: c.ai_description ?? '',
  }
}

export function SpeakerFormModal({
  workspaceId,
  opened,
  onClose,
  editingNode,
}: SpeakerFormModalProps) {
  const createNode = useCreateNodeMutation(workspaceId)
  const updateNode = useUpdateNodeMutation(workspaceId)

  const form = useForm<SpeakerFormValues>({
    mode: 'uncontrolled',
    initialValues: {
      title: '',
      position: '',
      style: '',
      notes: '',
      photoUrl: '',
      aiDescription: '',
    },
    validate: zodResolver(speakerSchema),
  })

  useEffect(() => {
    if (opened) {
      if (editingNode) {
        const sc = parseSpeakerContent(editingNode)
        form.setValues({
          title: editingNode.title,
          position: sc.position ?? '',
          style: sc.style ?? '',
          notes: sc.notes ?? '',
          photoUrl: sc.photo_url ?? '',
          aiDescription: sc.ai_description ?? '',
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
    const content: Record<string, unknown> = {
      position: values.position || undefined,
      style: values.style || undefined,
      notes: values.notes || undefined,
      photo_url: values.photoUrl || undefined,
      ai_description: values.aiDescription || undefined,
    }

    if (isEditing) {
      updateNode.mutate(
        { nodeId: editingNode.id, data: { title: values.title, content } },
        {
          onSuccess: () => {
            notifications.show({ title: 'Сохранено', message: 'Спикер обновлён', color: 'green' })
            onClose()
          },
          onError: () => {
            notifications.show({ title: 'Ошибка', message: 'Не удалось сохранить', color: 'red' })
          },
        },
      )
    } else {
      createNode.mutate(
        { node_type: 'speaker', title: values.title, content },
        {
          onSuccess: () => {
            notifications.show({ title: 'Создано', message: 'Спикер добавлен', color: 'green' })
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
      title={isEditing ? 'Редактировать спикера' : 'Добавить спикера'}
      centered
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label="Имя спикера"
            placeholder="Иван Петров"
            withAsterisk
            key={form.key('title')}
            {...form.getInputProps('title')}
          />

          <Group grow>
            <TextInput
              label="Должность"
              placeholder="Основатель, CEO, Директор..."
              key={form.key('position')}
              {...form.getInputProps('position')}
            />
            <Select
              label="Стиль подачи"
              placeholder="Выберите стиль"
              data={STYLE_OPTIONS}
              clearable
              searchable
              allowDeselect
              key={form.key('style')}
              {...form.getInputProps('style')}
            />
          </Group>

          <Textarea
            label="Особенности для сценария"
            placeholder="Что учитывать при написании сценария с этим спикером..."
            minRows={3}
            autosize
            maxRows={6}
            key={form.key('notes')}
            {...form.getInputProps('notes')}
          />

          <Textarea
            label="Описание для AI"
            description="Как AI должен учитывать этого спикера при генерации контента"
            placeholder="Опишите характер, манеру речи, ключевые темы..."
            minRows={3}
            autosize
            maxRows={6}
            key={form.key('aiDescription')}
            {...form.getInputProps('aiDescription')}
          />

          <TextInput
            label="Фото URL"
            placeholder="https://example.com/photo.jpg"
            key={form.key('photoUrl')}
            {...form.getInputProps('photoUrl')}
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
