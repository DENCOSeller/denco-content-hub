'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Stack,
  Switch,
  Slider,
  MultiSelect,
  Text,
  Paper,
  Group,
  Loader,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'

import {
  useAlertSettingsQuery,
  useUpdateAlertSettingsMutation,
  useTrendNichesQuery,
} from '@/api/hooks/useTrends'
import type { TrendAlertSettingsUpdate } from '@/api/types/trend'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'

const MAX_NICHES_FOR_SELECT = 100

interface AlertSettingsProps {
  workspaceId: number
}

export function AlertSettings({ workspaceId }: AlertSettingsProps) {
  const { data: settings, isLoading, isError, refetch } = useAlertSettingsQuery(workspaceId)
  const { data: nichesData } = useTrendNichesQuery(workspaceId, 1, MAX_NICHES_FOR_SELECT)
  const updateSettings = useUpdateAlertSettingsMutation(workspaceId)

  const [localViralScore, setLocalViralScore] = useState<number | null>(null)
  const [localGrowthRate, setLocalGrowthRate] = useState<number | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // Sync local slider state when server data changes
  useEffect(() => {
    if (settings) {
      setLocalViralScore(null)
      setLocalGrowthRate(null)
    }
  }, [settings])

  const mutateWithNotify = useCallback(
    (patch: TrendAlertSettingsUpdate) => {
      updateSettings.mutate(patch, {
        onSuccess: () => {
          notifications.show({
            title: 'Сохранено',
            message: 'Настройки алертов обновлены',
            color: 'green',
          })
        },
        onError: () => {
          notifications.show({
            title: 'Ошибка',
            message: 'Не удалось сохранить настройки',
            color: 'red',
          })
        },
      })
    },
    [updateSettings],
  )

  const handleDebouncedUpdate = useCallback(
    (patch: TrendAlertSettingsUpdate) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        mutateWithNotify(patch)
      }, 500)
    },
    [mutateWithNotify],
  )

  if (isLoading) return <LoadingState />
  if (isError) return <ErrorState onRetry={refetch} />
  if (!settings) return null

  const disabled = !settings.is_enabled

  const nicheOptions = (nichesData?.items ?? []).map((n) => ({
    value: String(n.id),
    label: n.name,
  }))

  const viralScoreValue = localViralScore ?? settings.min_viral_score
  const growthRateValue = localGrowthRate ?? settings.min_growth_rate

  return (
    <Stack gap="lg">
      <Switch
        label="Алерты включены"
        checked={settings.is_enabled}
        onChange={(e) => mutateWithNotify({ is_enabled: e.currentTarget.checked })}
      />

      <Paper p="md" radius="md" withBorder>
        <Stack gap="sm">
          <Text fw={600} size="sm">Типы уведомлений</Text>
          <Switch
            label="Новый тренд"
            checked={settings.notify_new_trend}
            disabled={disabled}
            onChange={(e) => mutateWithNotify({ notify_new_trend: e.currentTarget.checked })}
          />
          <Switch
            label="Вирусный тренд"
            checked={settings.notify_viral_trend}
            disabled={disabled}
            onChange={(e) => mutateWithNotify({ notify_viral_trend: e.currentTarget.checked })}
          />
          <Switch
            label="Всплеск в нише"
            checked={settings.notify_niche_spike}
            disabled={disabled}
            onChange={(e) => mutateWithNotify({ notify_niche_spike: e.currentTarget.checked })}
          />
        </Stack>
      </Paper>

      <Paper p="md" radius="md" withBorder>
        <Stack gap="md">
          <Text fw={600} size="sm">Пороги</Text>
          <div>
            <Group justify="space-between" mb={4}>
              <Text size="sm">Минимальный Viral Score</Text>
              <Text size="sm" c="dimmed">{viralScoreValue}</Text>
            </Group>
            <Slider
              value={viralScoreValue}
              min={0}
              max={100}
              step={5}
              disabled={disabled}
              onChange={(val) => setLocalViralScore(val)}
              onChangeEnd={(val) => {
                setLocalViralScore(val)
                mutateWithNotify({ min_viral_score: val })
              }}
            />
          </div>
          <div>
            <Group justify="space-between" mb={4}>
              <Text size="sm">Минимальная скорость роста %</Text>
              <Text size="sm" c="dimmed">{growthRateValue}</Text>
            </Group>
            <Slider
              value={growthRateValue}
              min={0}
              max={200}
              step={10}
              disabled={disabled}
              onChange={(val) => setLocalGrowthRate(val)}
              onChangeEnd={(val) => {
                setLocalGrowthRate(val)
                mutateWithNotify({ min_growth_rate: val })
              }}
            />
          </div>
        </Stack>
      </Paper>

      <Paper p="md" radius="md" withBorder>
        <Stack gap="sm">
          <Text fw={600} size="sm">Ниши</Text>
          <Text size="xs" c="dimmed">Пустой список = все ниши</Text>
          <MultiSelect
            data={nicheOptions}
            value={settings.niche_ids.map(String)}
            disabled={disabled}
            placeholder="Выберите ниши"
            searchable
            clearable
            onChange={(values) => handleDebouncedUpdate({ niche_ids: values.map(Number) })}
          />
        </Stack>
      </Paper>

      {updateSettings.isPending && (
        <Group gap="xs">
          <Loader size="xs" />
          <Text size="xs" c="dimmed">Сохранение...</Text>
        </Group>
      )}
    </Stack>
  )
}
