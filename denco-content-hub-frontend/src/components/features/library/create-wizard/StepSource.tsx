'use client'

import { Stack, Text, Textarea, UnstyledButton, Checkbox, Group, Loader } from '@mantine/core'
import { IconFileText, IconGraph, IconEdit } from '@tabler/icons-react'
import { useContentListQuery } from '@/api/hooks/useContent'
import { useNodeListQuery } from '@/api/hooks/useKnowledge'
import type { LibrarySourceType } from '@/api/client/types.gen'
import type { WizardState } from './wizard-types'
import styles from './create-wizard.module.css'

interface StepSourceProps {
  state: WizardState
  onChange: (updates: Partial<WizardState>) => void
  workspaceId: number
}

const SOURCE_OPTIONS: { value: LibrarySourceType; label: string; desc: string; icon: typeof IconFileText }[] = [
  { value: 'reference', label: 'Из Референсов', desc: 'Выберите обработанный источник', icon: IconFileText },
  { value: 'knowledge', label: 'Из Графа знаний', desc: 'Выберите узлы графа', icon: IconGraph },
  { value: 'manual', label: 'Вручную', desc: 'Опишите тему контента', icon: IconEdit },
]

export function StepSource({ state, onChange, workspaceId }: StepSourceProps) {
  const { data: refsData, isLoading: refsLoading } = useContentListQuery({
    workspaceId,
    size: 100,
    status: 'completed',
  })

  const { data: nodesRaw, isLoading: nodesLoading } = useNodeListQuery({
    workspaceId,
  })
  const nodesItems = Array.isArray(nodesRaw) ? nodesRaw : ((nodesRaw as unknown as { items?: typeof nodesRaw })?.items ?? [])

  function handleSourceType(value: LibrarySourceType) {
    onChange({
      sourceType: value,
      sourceReferenceId: null,
      sourceNodeIds: [],
      sourceText: '',
    })
  }

  function handleReferenceSelect(id: number) {
    onChange({ sourceReferenceId: state.sourceReferenceId === id ? null : id })
  }

  function handleNodeToggle(id: number) {
    const ids = state.sourceNodeIds.includes(id)
      ? state.sourceNodeIds.filter((n) => n !== id)
      : [...state.sourceNodeIds, id]
    onChange({ sourceNodeIds: ids })
  }

  return (
    <Stack gap="lg">
      <Text size="lg" fw={600}>Источник материала</Text>

      <Group gap="md" grow>
        {SOURCE_OPTIONS.map(({ value, label, desc, icon: Icon }) => {
          const selected = state.sourceType === value
          return (
            <UnstyledButton
              key={value}
              className={`${styles.sourceCard} ${selected ? styles.sourceCardSelected : ''}`}
              onClick={() => handleSourceType(value)}
              aria-label={`Источник ${label}`}
              aria-pressed={selected}
            >
              <Stack align="center" gap="xs">
                <Icon size={28} color={selected ? 'var(--eco-content)' : 'var(--text-muted)'} />
                <Text size="sm" fw={selected ? 600 : 400}>{label}</Text>
                <Text size="xs" c="dimmed">{desc}</Text>
              </Stack>
            </UnstyledButton>
          )
        })}
      </Group>

      {state.sourceType === 'reference' && (
        <Stack gap="sm">
          <Text size="sm" fw={500}>Выберите референс:</Text>
          {refsLoading && <Loader size="sm" />}
          {refsData?.items?.map((ref) => (
            <UnstyledButton
              key={ref.id}
              className={`${styles.referenceItem} ${state.sourceReferenceId === ref.id ? styles.referenceItemSelected : ''}`}
              onClick={() => handleReferenceSelect(ref.id)}
              aria-label={`Референс ${ref.title || `#${ref.id}`}`}
              aria-pressed={state.sourceReferenceId === ref.id}
            >
              <Text size="sm">{ref.title || `Источник #${ref.id}`}</Text>
              <Text size="xs" c="dimmed">{ref.status}</Text>
            </UnstyledButton>
          ))}
          {!refsLoading && !refsData?.items?.length && (
            <Text size="sm" c="dimmed">Нет обработанных референсов</Text>
          )}
        </Stack>
      )}

      {state.sourceType === 'knowledge' && (
        <Stack gap="sm">
          <Text size="sm" fw={500}>Выберите узлы графа знаний:</Text>
          {nodesLoading && <Loader size="sm" />}
          {nodesItems.map((node) => (
            <Checkbox
              key={node.id}
              label={`${node.title} (${node.node_type_def?.slug ?? 'note'})`}
              checked={state.sourceNodeIds.includes(node.id)}
              onChange={() => handleNodeToggle(node.id)}
            />
          ))}
          {!nodesLoading && nodesItems.length === 0 && (
            <Text size="sm" c="dimmed">Нет узлов в графе знаний</Text>
          )}
        </Stack>
      )}

      {state.sourceType === 'manual' && (
        <Textarea
          label="Тема / описание контента"
          placeholder="Опишите о чём будет контент..."
          minRows={4}
          value={state.sourceText}
          onChange={(e) => onChange({ sourceText: e.currentTarget.value })}
        />
      )}

      <Textarea
        label="Замысел / Идея"
        description="Авторский замысел — будет передан в AI как контекст для генерации"
        placeholder="Опиши идею, угол подачи или что хочешь донести этим контентом. Например: хочу показать как обычный человек без опыта вышел на WB и заработал за 3 месяца..."
        minRows={4}
        withAsterisk
        value={state.ideaText}
        onChange={(e) => onChange({ ideaText: e.currentTarget.value })}
      />
    </Stack>
  )
}
