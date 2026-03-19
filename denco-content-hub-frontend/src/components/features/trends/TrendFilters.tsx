'use client'

import { Group, Select, NumberInput } from '@mantine/core'

import type { TrendStage, TrendNiche } from '@/api/types/trend'

interface TrendFiltersProps {
  nicheId: number | null
  stage: TrendStage | null
  minViralScore: number | null
  sortBy: string | null
  niches: TrendNiche[]
  onNicheChange: (value: number | null) => void
  onStageChange: (value: TrendStage | null) => void
  onMinViralScoreChange: (value: number | null) => void
  onSortByChange: (value: string | null) => void
}

const STAGE_OPTIONS = [
  { value: 'rising', label: 'Растёт' },
  { value: 'peaking', label: 'Пик' },
  { value: 'declining', label: 'Спад' },
]

const SORT_OPTIONS = [
  { value: 'viral_score', label: 'Viral Score' },
  { value: 'views', label: 'Просмотры' },
  { value: 'detected_at', label: 'Дата обнаружения' },
  { value: 'velocity', label: 'Скорость роста' },
]

export function TrendFilters({
  nicheId,
  stage,
  minViralScore,
  sortBy,
  niches,
  onNicheChange,
  onStageChange,
  onMinViralScoreChange,
  onSortByChange,
}: TrendFiltersProps) {
  const nicheOptions = niches.map((n) => ({
    value: String(n.id),
    label: n.name,
  }))

  return (
    <Group gap="sm" wrap="wrap">
      <Select
        placeholder="Ниша"
        data={nicheOptions}
        value={nicheId != null ? String(nicheId) : null}
        onChange={(v) => onNicheChange(v ? Number(v) : null)}
        clearable
        size="xs"
        w={160}
      />
      <Select
        placeholder="Стадия"
        data={STAGE_OPTIONS}
        value={stage}
        onChange={(v) => onStageChange(v as TrendStage | null)}
        clearable
        size="xs"
        w={130}
      />
      <NumberInput
        placeholder="Виральность от"
        value={minViralScore ?? ''}
        onChange={(v) => onMinViralScoreChange(typeof v === 'number' ? v : null)}
        min={0}
        max={100}
        size="xs"
        w={140}
      />
      <Select
        placeholder="Сортировка"
        data={SORT_OPTIONS}
        value={sortBy}
        onChange={onSortByChange}
        clearable
        size="xs"
        w={160}
      />
    </Group>
  )
}
