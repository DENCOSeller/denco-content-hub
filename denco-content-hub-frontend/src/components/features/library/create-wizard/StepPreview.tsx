'use client'

import { Stack, Text, Paper } from '@mantine/core'
import {
  PLATFORM_LABELS,
  CONTENT_TYPE_LABELS,
  CATEGORY_LABELS,
  SOURCE_TYPE_LABELS,
  HUNT_LEVEL_OPTIONS,
} from './wizard-types'
import type { WizardState } from './wizard-types'
import styles from './create-wizard.module.css'

interface StepPreviewProps {
  state: WizardState
}

function SummaryRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className={styles.summaryRow}>
      <Text className={styles.summaryLabel}>{label}</Text>
      <Text className={styles.summaryValue}>{value}</Text>
    </div>
  )
}

export function StepPreview({ state }: StepPreviewProps) {
  const huntLabel = state.huntLevel
    ? HUNT_LEVEL_OPTIONS.find((o) => o.value === String(state.huntLevel))?.label ?? null
    : null

  const sourceDesc = state.sourceType
    ? SOURCE_TYPE_LABELS[state.sourceType]
    : null

  return (
    <Stack gap="lg">
      <Text size="lg" fw={600}>Проверьте параметры</Text>

      <Paper p="lg" radius="md" bg="var(--card-bg)">
        <Stack gap={0}>
          <SummaryRow label="Тема" value={state.title || null} />
          <SummaryRow
            label="Платформа"
            value={state.platform ? PLATFORM_LABELS[state.platform] : null}
          />
          <SummaryRow
            label="Тип контента"
            value={state.contentType ? CONTENT_TYPE_LABELS[state.contentType] : null}
          />
          <SummaryRow
            label="Категория"
            value={state.category ? CATEGORY_LABELS[state.category] : null}
          />
          <SummaryRow label="Источник" value={sourceDesc} />
          {state.ideaText && (
            <SummaryRow label="Замысел / Идея" value={state.ideaText.slice(0, 150)} />
          )}
          {state.sourceType === 'reference' && state.sourceReferenceId && (
            <SummaryRow label="Референс ID" value={`#${state.sourceReferenceId}`} />
          )}
          {state.sourceType === 'knowledge' && state.sourceNodeIds.length > 0 && (
            <SummaryRow label="Узлы графа" value={`${state.sourceNodeIds.length} выбрано`} />
          )}
          {state.sourceType === 'manual' && state.sourceText && (
            <SummaryRow label="Описание" value={state.sourceText.slice(0, 100)} />
          )}
          <SummaryRow label="Уровень Ханта" value={huntLabel} />
          {state.speakerNodeId && <SummaryRow label="Спикер" value={state.settingsLabels.speaker ?? `ID: ${state.speakerNodeId}`} />}
          {state.contentGoalNodeId && <SummaryRow label="Цель контента" value={state.settingsLabels.contentGoal ?? `ID: ${state.contentGoalNodeId}`} />}
          {state.narrativeNodeId && <SummaryRow label="Нарратив" value={state.settingsLabels.narrative ?? `ID: ${state.narrativeNodeId}`} />}
          {state.hookTypeNodeId && <SummaryRow label="Тип хука" value={state.settingsLabels.hookType ?? `ID: ${state.hookTypeNodeId}`} />}
          {state.toneNodeId && <SummaryRow label="Тональность" value={state.settingsLabels.tone ?? `ID: ${state.toneNodeId}`} />}
          {state.productNodeId && <SummaryRow label="Продукт" value={state.settingsLabels.product ?? `ID: ${state.productNodeId}`} />}
        </Stack>
      </Paper>
    </Stack>
  )
}
