'use client'

import { useState } from 'react'
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  ColorInput,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { zodResolver } from 'mantine-form-zod-resolver'
import { notifications } from '@mantine/notifications'
import {
  IconPlus,
  IconTrash,
  IconNote,
} from '@tabler/icons-react'

import {
  useNodeTypeDefs,
  useCreateNodeTypeDef,
  useDeactivateNodeTypeDef,
} from '@/api/hooks/useKgTypes'
import { nodeTypeDefCreateSchema } from '@/lib/validations/node-type'

import type { KgNodeTypeDefCreate } from '@/api/client/types.gen'

import styles from './NodeTypeManager.module.css'

interface NodeTypeManagerProps {
  companyId: number
}

const PRESET_COLORS = [
  '#0A84FF', '#5E5CE6', '#BF5AF2', '#FF375F',
  '#FF9F0A', '#30D158', '#64D2FF', '#8E8E93',
]

export function NodeTypeManager({ companyId }: NodeTypeManagerProps) {
  const [createOpened, setCreateOpened] = useState(false)
  const [deactivatingId, setDeactivatingId] = useState<number | null>(null)

  const { data, isLoading, isError, refetch } = useNodeTypeDefs(companyId)
  const createMutation = useCreateNodeTypeDef(companyId)
  const deactivateMutation = useDeactivateNodeTypeDef(companyId)

  const form = useForm({
    initialValues: {
      label: '',
      slug: '',
      icon: 'IconNote',
      color: '#8E8E93',
    },
    validate: zodResolver(nodeTypeDefCreateSchema),
  })

  function handleCreate(values: typeof form.values) {
    const body: KgNodeTypeDefCreate = {
      label: values.label,
      slug: values.slug,
      icon: values.icon || 'IconNote',
      color: values.color || '#8E8E93',
    }

    createMutation.mutate(body, {
      onSuccess: () => {
        notifications.show({
          title: 'Тип создан',
          message: `Тип «${values.label}» успешно добавлен`,
          color: 'green',
        })
        form.reset()
        setCreateOpened(false)
      },
      onError: () => {
        notifications.show({
          title: 'Ошибка',
          message: 'Не удалось создать тип узла',
          color: 'red',
        })
      },
    })
  }

  function handleDeactivate(typeId: number, label: string) {
    setDeactivatingId(typeId)
    deactivateMutation.mutate(typeId, {
      onSuccess: () => {
        setDeactivatingId(null)
        notifications.show({
          title: 'Тип деактивирован',
          message: `«${label}» больше не доступен для новых узлов`,
          color: 'yellow',
        })
      },
      onError: () => {
        setDeactivatingId(null)
        notifications.show({
          title: 'Ошибка',
          message: 'Не удалось деактивировать тип',
          color: 'red',
        })
      },
    })
  }

  if (isLoading) {
    return (
      <Stack align="center" justify="center" h={200}>
        <Loader size="sm" />
      </Stack>
    )
  }

  if (isError) {
    return (
      <Stack align="center" justify="center" h={200} gap="sm">
        <Text c="dimmed" size="sm">Ошибка загрузки типов</Text>
        <Button variant="light" size="xs" onClick={() => refetch()}>
          Повторить
        </Button>
      </Stack>
    )
  }

  const types = data ?? []

  return (
    <Stack gap="md">
      {/* Header */}
      <Group justify="space-between">
        <Text fw={600} size="lg">Типы узлов</Text>
        <Button
          leftSection={<IconPlus size={16} />}
          size="xs"
          variant="light"
          onClick={() => setCreateOpened(true)}
        >
          Добавить тип
        </Button>
      </Group>

      {/* List */}
      {types.length === 0 ? (
        <Stack align="center" gap="xs" py="xl">
          <Text c="dimmed" size="sm">Нет типов узлов</Text>
        </Stack>
      ) : (
        <Stack gap={8}>
          {types.map((t) => (
            <div
              key={t.id}
              className={`${styles.typeRow} ${!t.is_active ? styles.typeRowInactive : ''}`}
            >
              <Box
                className={styles.iconBadge}
                style={{ background: t.color }}
              >
                <IconNote size={16} color="#fff" />
              </Box>

              <Box style={{ flex: 1, minWidth: 0 }}>
                <Group gap={6} wrap="nowrap">
                  <Text fw={600} size="sm" lineClamp={1}>
                    {t.label}
                  </Text>
                  <Text className={styles.slug}>{t.slug}</Text>
                </Group>
              </Box>

              <Badge
                size="xs"
                variant="light"
                color={t.is_system ? 'blue' : 'gray'}
              >
                {t.is_system ? 'system' : 'company'}
              </Badge>

              <Badge
                size="xs"
                variant="dot"
                color={t.is_active ? 'green' : 'red'}
              >
                {t.is_active ? 'active' : 'inactive'}
              </Badge>

              {!t.is_system && t.is_active && (
                <Tooltip label="Деактивировать" position="left">
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    loading={deactivatingId === t.id}
                    onClick={() => handleDeactivate(t.id, t.label)}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Tooltip>
              )}
            </div>
          ))}
        </Stack>
      )}

      {/* Create modal */}
      <Modal
        opened={createOpened}
        onClose={() => { form.reset(); setCreateOpened(false) }}
        title="Новый тип узла"
        centered
        className={styles.modal}
        overlayProps={{ backgroundOpacity: 0.6, blur: 8 }}
      >
        <form onSubmit={form.onSubmit(handleCreate)}>
          <Stack gap="md">
            <TextInput
              label="Название"
              placeholder="Например: Инсайт"
              withAsterisk
              {...form.getInputProps('label')}
            />

            <TextInput
              label="Slug"
              placeholder="insight"
              description="Латиница, цифры и _ (начинается с буквы)"
              withAsterisk
              {...form.getInputProps('slug')}
            />

            <TextInput
              label="Иконка (Tabler)"
              placeholder="IconNote"
              description="Имя иконки из @tabler/icons-react"
              {...form.getInputProps('icon')}
            />

            <ColorInput
              label="Цвет"
              swatches={PRESET_COLORS}
              swatchesPerRow={8}
              {...form.getInputProps('color')}
            />

            <div className={styles.footer}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => { form.reset(); setCreateOpened(false) }}
              >
                Отмена
              </button>
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </Stack>
        </form>
      </Modal>
    </Stack>
  )
}
