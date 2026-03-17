'use client'

import { useState } from 'react'
import {
  Modal,
  Stack,
  Group,
  Button,
  Text,
  Select,
  TextInput,
  ActionIcon,
  Badge,
  Card,
  Loader,
  Tooltip,
} from '@mantine/core'
import { useClipboard } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconCopy, IconCheck, IconTrash, IconPlayerPlay, IconPlayerPause } from '@tabler/icons-react'

import {
  useKgPublicLinks,
  useCreatePublicLink,
  useUpdatePublicLink,
  useDeletePublicLink,
} from '@/api/hooks/useKgPublicLinks'
import type { KgPublicLinkResponse } from '@/api/hooks/useKgPublicLinks'
import type { KnowledgeScope } from '@/hooks/useKnowledgeGraph'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShareGraphModalProps {
  opened: boolean
  onClose: () => void
  scope: KnowledgeScope
  scopeId: number
}

const VISIBILITY_OPTIONS = [
  { value: 'active', label: 'Только активные' },
  { value: 'all', label: 'Все узлы' },
]

// ---------------------------------------------------------------------------
// Link card
// ---------------------------------------------------------------------------

function LinkCard({
  link,
  scope,
  scopeId,
}: {
  link: KgPublicLinkResponse
  scope: KnowledgeScope
  scopeId: number
}) {
  const clipboard = useClipboard({ timeout: 2000 })
  const [confirmDelete, setConfirmDelete] = useState(false)

  const updateLink = useUpdatePublicLink(scope, scopeId)
  const deleteLink = useDeletePublicLink(scope, scopeId)

  const handleToggleActive = () => {
    updateLink.mutate(
      { linkId: link.id, body: { is_active: !link.is_active } },
      {
        onError: () => {
          notifications.show({ color: 'red', message: 'Не удалось обновить ссылку' })
        },
      },
    )
  }

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    deleteLink.mutate(link.id, {
      onSuccess: () => setConfirmDelete(false),
      onError: () => {
        notifications.show({ color: 'red', message: 'Не удалось удалить ссылку' })
        setConfirmDelete(false)
      },
    })
  }

  const visibilityLabel =
    link.visibility_mode === 'all' ? 'Все узлы' : 'Только активные'

  return (
    <Card padding="sm" radius="md" withBorder>
      <Stack gap="xs">
        <Group justify="space-between">
          <Group gap="xs">
            <Badge color={link.is_active ? 'green' : 'gray'} variant="light" size="sm">
              {link.is_active ? 'Активна' : 'Деактивирована'}
            </Badge>
            <Text size="xs" c="dimmed">{visibilityLabel}</Text>
          </Group>
          <Group gap={4}>
            <Tooltip label={link.is_active ? 'Деактивировать' : 'Активировать'} withArrow>
              <ActionIcon
                size="sm"
                variant="subtle"
                color={link.is_active ? 'yellow' : 'green'}
                onClick={handleToggleActive}
                loading={updateLink.isPending}
              >
                {link.is_active ? <IconPlayerPause size={14} /> : <IconPlayerPlay size={14} />}
              </ActionIcon>
            </Tooltip>
            <Tooltip label={confirmDelete ? 'Подтвердить удаление' : 'Удалить'} withArrow>
              <ActionIcon
                size="sm"
                variant="subtle"
                color="red"
                onClick={handleDelete}
                loading={deleteLink.isPending}
              >
                <IconTrash size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {link.title && (
          <Text size="sm" fw={500}>{link.title}</Text>
        )}

        <Group gap="xs" wrap="nowrap">
          <TextInput
            size="xs"
            readOnly
            value={link.public_url}
            style={{ flex: 1 }}
          />
          <Tooltip label={clipboard.copied ? 'Скопировано!' : 'Скопировать'} withArrow>
            <ActionIcon
              size="sm"
              variant="subtle"
              color={clipboard.copied ? 'teal' : 'gray'}
              onClick={() => clipboard.copy(link.public_url)}
            >
              {clipboard.copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
            </ActionIcon>
          </Tooltip>
        </Group>
      </Stack>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function ShareGraphModal({ opened, onClose, scope, scopeId }: ShareGraphModalProps) {
  const [showForm, setShowForm] = useState(false)
  const [visibility, setVisibility] = useState<string>('active')
  const [title, setTitle] = useState('')

  const { data: links, isLoading, error } = useKgPublicLinks(scope, scopeId)
  const createLink = useCreatePublicLink(scope, scopeId)

  const clipboard = useClipboard({ timeout: 2000 })

  const resetForm = () => {
    setShowForm(false)
    setVisibility('active')
    setTitle('')
  }

  const handleClose = () => {
    resetForm()
    createLink.reset()
    onClose()
  }

  const handleCreate = () => {
    createLink.mutate(
      {
        visibility_mode: visibility,
        title: title.trim() || null,
      },
      {
        onSuccess: (data) => {
          clipboard.copy(data.public_url)
          notifications.show({
            color: 'teal',
            message: 'Ссылка создана и скопирована в буфер обмена',
          })
          resetForm()
        },
        onError: () => {
          notifications.show({ color: 'red', message: 'Не удалось создать ссылку' })
        },
      },
    )
  }

  const hasLinks = !!links?.length

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Публичные ссылки"
      centered
      size="md"
    >
      <Stack gap="md">
        {isLoading && (
          <Group justify="center" py="xl">
            <Loader size="sm" />
          </Group>
        )}

        {error && (
          <Text size="sm" c="red">Не удалось загрузить ссылки</Text>
        )}

        {!isLoading && !hasLinks && !showForm && (
          <Stack align="center" gap="sm" py="lg">
            <Text size="sm" c="dimmed">Нет публичных ссылок</Text>
            <Button variant="light" onClick={() => setShowForm(true)}>
              Создать ссылку
            </Button>
          </Stack>
        )}

        {!isLoading && hasLinks && !showForm && (
          <Button variant="light" size="xs" onClick={() => setShowForm(true)}>
            Создать ссылку
          </Button>
        )}

        {showForm && (
          <Card padding="sm" radius="md" withBorder>
            <Stack gap="sm">
              <Select
                label="Режим видимости"
                size="xs"
                data={VISIBILITY_OPTIONS}
                value={visibility}
                onChange={(v) => v && setVisibility(v)}
                allowDeselect={false}
              />
              <TextInput
                label="Заголовок (опционально)"
                size="xs"
                placeholder="Название ссылки"
                value={title}
                onChange={(e) => setTitle(e.currentTarget.value)}
              />
              <Group justify="flex-end" gap="xs">
                <Button variant="subtle" color="gray" size="xs" onClick={resetForm}>
                  Отмена
                </Button>
                <Button size="xs" onClick={handleCreate} loading={createLink.isPending}>
                  Создать
                </Button>
              </Group>
            </Stack>
          </Card>
        )}

        {!isLoading && hasLinks && (
          <Stack gap="xs">
            {links.map((link) => (
              <LinkCard key={link.id} link={link} scope={scope} scopeId={scopeId} />
            ))}
          </Stack>
        )}
      </Stack>
    </Modal>
  )
}
