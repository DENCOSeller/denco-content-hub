'use client'

import { useState } from 'react'
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Modal,
  Stack,
  Switch,
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
  IconArrowRight,
  IconArrowsHorizontal,
} from '@tabler/icons-react'

import {
  useEdgeTypeDefs,
  useCreateEdgeTypeDef,
  useDeactivateEdgeTypeDef,
} from '@/api/hooks/useKgTypes'
import { edgeTypeDefCreateSchema } from '@/lib/validations/edge-type'

import type { KgEdgeTypeDefCreate } from '@/api/client/types.gen'

import styles from './NodeTypeManager.module.css'

interface EdgeTypeManagerProps {
  companyId: number
}

export function EdgeTypeManager({ companyId }: EdgeTypeManagerProps) {
  const [createOpened, setCreateOpened] = useState(false)

  const { data, isLoading, isError, refetch } = useEdgeTypeDefs(companyId)
  const createMutation = useCreateEdgeTypeDef(companyId)
  const deactivateMutation = useDeactivateEdgeTypeDef(companyId)

  const form = useForm({
    initialValues: {
      label: '',
      slug: '',
      description: '',
      is_directed: true,
    },
    validate: zodResolver(edgeTypeDefCreateSchema),
  })

  function handleCreate(values: typeof form.values) {
    const body: KgEdgeTypeDefCreate = {
      label: values.label,
      slug: values.slug,
      description: values.description || undefined,
      is_directed: values.is_directed,
    }

    createMutation.mutate(body, {
      onSuccess: () => {
        notifications.show({
          title: 'Тип связи создан',
          message: `Тип «${values.label}» успешно добавлен`,
          color: 'green',
        })
        form.reset()
        setCreateOpened(false)
      },
      onError: () => {
        notifications.show({
          title: 'Ошибка',
          message: 'Не удалось создать тип связи',
          color: 'red',
        })
      },
    })
  }

  function handleDeactivate(typeId: number, label: string) {
    deactivateMutation.mutate(typeId, {
      onSuccess: () => {
        notifications.show({
          title: 'Тип деактивирован',
          message: `«${label}» больше не доступен для новых связей`,
          color: 'yellow',
        })
      },
      onError: () => {
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
        <Text c="dimmed" size="sm">Ошибка загрузки типов связей</Text>
        <Button variant="light" size="xs" onClick={() => refetch()}>
          Повторить
        </Button>
      </Stack>
    )
  }

  const types = data ?? []

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={600} size="lg">Типы связей</Text>
        <Button
          leftSection={<IconPlus size={16} />}
          size="xs"
          variant="light"
          onClick={() => setCreateOpened(true)}
        >
          Добавить тип
        </Button>
      </Group>

      {types.length === 0 ? (
        <Stack align="center" gap="xs" py="xl">
          <Text c="dimmed" size="sm">Нет типов связей</Text>
        </Stack>
      ) : (
        <Stack gap={8}>
          {types.map((t) => (
            <div
              key={t.id}
              className={`${styles.typeRow} ${!t.is_active ? styles.typeRowInactive : ''}`}
            >
              <Box className={styles.iconBadge} style={{ background: '#5E5CE6' }}>
                {t.is_directed
                  ? <IconArrowRight size={16} color="#fff" />
                  : <IconArrowsHorizontal size={16} color="#fff" />
                }
              </Box>

              <Box className="flexFill">
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
                    loading={deactivateMutation.isPending}
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

      <Modal
        opened={createOpened}
        onClose={() => { form.reset(); setCreateOpened(false) }}
        title="Новый тип связи"
        centered
        className={styles.modal}
        overlayProps={{ backgroundOpacity: 0.6, blur: 8 }}
      >
        <form onSubmit={form.onSubmit(handleCreate)}>
          <Stack gap="md">
            <TextInput
              label="Название"
              placeholder="Например: Упоминает"
              withAsterisk
              {...form.getInputProps('label')}
            />

            <TextInput
              label="Slug"
              placeholder="mentions"
              description="Латиница, цифры и _ (начинается с буквы)"
              withAsterisk
              {...form.getInputProps('slug')}
            />

            <TextInput
              label="Описание"
              placeholder="Краткое описание типа связи"
              {...form.getInputProps('description')}
            />

            <Switch
              label="Направленная связь"
              description="Если включено — связь имеет направление (A → B)"
              {...form.getInputProps('is_directed', { type: 'checkbox' })}
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
