'use client'

import { useEffect } from 'react'
import {
  Modal,
  TextInput,
  TagsInput,
  MultiSelect,
  Select,
  Button,
  Group,
  Stack,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { zodResolver } from 'mantine-form-zod-resolver'
import { notifications } from '@mantine/notifications'
import { z } from 'zod'

import type { TrendNiche, TrendPlatform } from '@/api/types/trend'
import {
  useCreateTrendNicheMutation,
  useUpdateTrendNicheMutation,
} from '@/api/hooks/useTrends'

interface NicheFormModalProps {
  opened: boolean
  onClose: () => void
  workspaceId: number
  niche?: TrendNiche | null
}

const nicheSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  keywords: z.array(z.string()).min(1, 'Добавьте хотя бы одно ключевое слово'),
  platforms: z.array(z.string()).min(1, 'Выберите хотя бы одну платформу'),
  monitoring_interval_hours: z.string().min(1, 'Выберите интервал'),
})

type NicheFormValues = z.infer<typeof nicheSchema>

const PLATFORM_OPTIONS = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' },
]

const INTERVAL_OPTIONS = [
  { value: '1', label: 'Каждый час' },
  { value: '3', label: 'Каждые 3 часа' },
  { value: '6', label: 'Каждые 6 часов' },
  { value: '12', label: 'Каждые 12 часов' },
  { value: '24', label: 'Раз в сутки' },
]

function getInitialValues(niche?: TrendNiche | null): NicheFormValues {
  if (niche) {
    return {
      name: niche.name,
      keywords: niche.keywords,
      platforms: niche.platforms,
      monitoring_interval_hours: String(niche.monitoring_interval_hours),
    }
  }
  return {
    name: '',
    keywords: [],
    platforms: ['youtube'],
    monitoring_interval_hours: '6',
  }
}

export function NicheFormModal({ opened, onClose, workspaceId, niche }: NicheFormModalProps) {
  const isEdit = !!niche
  const createNiche = useCreateTrendNicheMutation(workspaceId)
  const updateNiche = useUpdateTrendNicheMutation(workspaceId)

  const form = useForm<NicheFormValues>({
    mode: 'uncontrolled',
    initialValues: getInitialValues(niche),
    validate: zodResolver(nicheSchema),
  })

  useEffect(() => {
    if (opened) {
      form.setValues(getInitialValues(niche))
      form.resetDirty()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, niche])

  function handleClose() {
    form.reset()
    onClose()
  }

  const handleSubmit = form.onSubmit(async (values) => {
    const platforms = values.platforms as TrendPlatform[]
    const intervalHours = Number(values.monitoring_interval_hours)

    try {
      if (isEdit) {
        await updateNiche.mutateAsync({
          nicheId: niche.id,
          data: {
            name: values.name,
            keywords: values.keywords,
            platforms,
            monitoring_interval_hours: intervalHours,
          },
        })
        notifications.show({
          title: 'Сохранено',
          message: `Ниша «${values.name}» обновлена`,
          color: 'green',
        })
      } else {
        await createNiche.mutateAsync({
          name: values.name,
          keywords: values.keywords,
          platforms,
          monitoring_interval_hours: intervalHours,
        })
        notifications.show({
          title: 'Создано',
          message: `Ниша «${values.name}» добавлена`,
          color: 'green',
        })
      }
      handleClose()
    } catch {
      notifications.show({
        title: 'Ошибка',
        message: isEdit
          ? 'Не удалось обновить нишу'
          : 'Не удалось создать нишу',
        color: 'red',
      })
    }
  })

  const isPending = createNiche.isPending || updateNiche.isPending

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={isEdit ? 'Редактировать нишу' : 'Новая ниша'}
      centered
      overlayProps={{ backgroundOpacity: 0.6, blur: 8 }}
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="Название"
            placeholder="Например: Фитнес и здоровье"
            key={form.key('name')}
            {...form.getInputProps('name')}
          />

          <TagsInput
            label="Ключевые слова"
            placeholder="Введите и нажмите Enter"
            description="Слова для поиска трендов в этой нише"
            key={form.key('keywords')}
            {...form.getInputProps('keywords')}
          />

          <MultiSelect
            label="Платформы"
            placeholder="Выберите платформы"
            data={PLATFORM_OPTIONS}
            key={form.key('platforms')}
            {...form.getInputProps('platforms')}
          />

          <Select
            label="Интервал мониторинга"
            placeholder="Как часто проверять"
            data={INTERVAL_OPTIONS}
            key={form.key('monitoring_interval_hours')}
            {...form.getInputProps('monitoring_interval_hours')}
          />

          <Group justify="flex-end">
            <Button variant="default" onClick={handleClose}>
              Отмена
            </Button>
            <Button type="submit" loading={isPending}>
              {isEdit ? 'Сохранить' : 'Создать'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
