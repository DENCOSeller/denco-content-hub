'use client'

import { SimpleGrid, Stack, Select, Text } from '@mantine/core'
import { useKnowledgeNodesByType } from '@/api/hooks/useKnowledge'
import { HUNT_LEVEL_OPTIONS } from './wizard-types'
import type { WizardState } from './wizard-types'

interface StepSettingsProps {
  state: WizardState
  onChange: (updates: Partial<WizardState>) => void
  workspaceId: number
}

export function StepSettings({ state, onChange, workspaceId }: StepSettingsProps) {
  const { data: speakers } = useKnowledgeNodesByType(workspaceId, 'speaker')
  const { data: goals } = useKnowledgeNodesByType(workspaceId, 'content_goal')
  const { data: narratives } = useKnowledgeNodesByType(workspaceId, 'narrative_format')
  const { data: hooks } = useKnowledgeNodesByType(workspaceId, 'hook_type')
  const { data: tones } = useKnowledgeNodesByType(workspaceId, 'tone_of_voice')
  const { data: products } = useKnowledgeNodesByType(workspaceId, 'product_focus')

  function toSelectData(data: typeof speakers) {
    if (!data) return []
    const items = Array.isArray(data) ? data : (data as { items?: typeof speakers }).items ?? []
    return items.map((n: { id: number; title: string }) => ({ value: String(n.id), label: n.title }))
  }

  function findLabel(data: typeof speakers, id: string | null): string | null {
    if (!id || !data) return null
    const items = Array.isArray(data) ? data : (data as { items?: typeof speakers }).items ?? []
    return items.find((n: { id: number; title: string }) => String(n.id) === id)?.title ?? null
  }

  function handleNodeSelect(
    field: keyof WizardState,
    labelKey: keyof WizardState['settingsLabels'],
    data: typeof speakers,
    value: string | null,
  ) {
    onChange({
      [field]: value ? Number(value) : null,
      settingsLabels: {
        ...state.settingsLabels,
        [labelKey]: findLabel(data, value),
      },
    })
  }

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Text size="lg" fw={600}>Расширенные настройки</Text>
        <Text size="sm" c="dimmed">Все поля опциональные — можете пропустить этот шаг</Text>
      </Stack>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <Select
          label="Уровень Ханта"
          placeholder="Выберите уровень"
          data={HUNT_LEVEL_OPTIONS}
          value={state.huntLevel ? String(state.huntLevel) : null}
          onChange={(v) => onChange({ huntLevel: v ? Number(v) : null })}
          clearable
        />

        <Select
          label="Спикер"
          placeholder="Выберите спикера"
          data={toSelectData(speakers)}
          value={state.speakerNodeId ? String(state.speakerNodeId) : null}
          onChange={(v) => handleNodeSelect('speakerNodeId', 'speaker', speakers, v)}
          clearable
          searchable
        />

        <Select
          label="Цель контента"
          placeholder="Выберите цель"
          data={toSelectData(goals)}
          value={state.contentGoalNodeId ? String(state.contentGoalNodeId) : null}
          onChange={(v) => handleNodeSelect('contentGoalNodeId', 'contentGoal', goals, v)}
          clearable
          searchable
        />

        <Select
          label="Нарративный формат"
          placeholder="Выберите формат"
          data={toSelectData(narratives)}
          value={state.narrativeNodeId ? String(state.narrativeNodeId) : null}
          onChange={(v) => handleNodeSelect('narrativeNodeId', 'narrative', narratives, v)}
          clearable
          searchable
        />

        <Select
          label="Тип хука"
          placeholder="Выберите тип"
          data={toSelectData(hooks)}
          value={state.hookTypeNodeId ? String(state.hookTypeNodeId) : null}
          onChange={(v) => handleNodeSelect('hookTypeNodeId', 'hookType', hooks, v)}
          clearable
          searchable
        />

        <Select
          label="Тональность"
          placeholder="Выберите тональность"
          data={toSelectData(tones)}
          value={state.toneNodeId ? String(state.toneNodeId) : null}
          onChange={(v) => handleNodeSelect('toneNodeId', 'tone', tones, v)}
          clearable
          searchable
        />

        <Select
          label="Продукт / Услуга"
          placeholder="Выберите продукт"
          data={toSelectData(products)}
          value={state.productNodeId ? String(state.productNodeId) : null}
          onChange={(v) => handleNodeSelect('productNodeId', 'product', products, v)}
          clearable
          searchable
        />
      </SimpleGrid>
    </Stack>
  )
}
