'use client'

import { Modal, TextInput, Button, Group, Stack, Text, ThemeIcon } from '@mantine/core'
import { useForm } from '@mantine/form'
import { zodResolver } from 'mantine-form-zod-resolver'
import { notifications } from '@mantine/notifications'
import { useAddCompetitorMutation, useResolveUrlMutation } from '@/api/hooks/useCompetitors'
import {
  addCompetitorSchema,
  type AddCompetitorFormValues,
} from '@/lib/validations/competitor'
import { platformConfig } from '@/components/features/competitors/constants'

interface AddChannelModalProps {
  opened: boolean
  onClose: () => void
  workspaceId: number
}

export function AddChannelModal({ opened, onClose, workspaceId }: AddChannelModalProps) {
  const addCompetitor = useAddCompetitorMutation(workspaceId)
  const resolveUrl = useResolveUrlMutation()

  const form = useForm<AddCompetitorFormValues>({
    mode: 'uncontrolled',
    initialValues: { url: '' },
    validate: zodResolver(addCompetitorSchema),
  })

  function handleClose() {
    form.reset()
    resolveUrl.reset()
    onClose()
  }

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await addCompetitor.mutateAsync(values.url)
      handleClose()
      notifications.show({
        title: 'Канал добавлен',
        message: 'Канал успешно добавлен. Синхронизация начнётся автоматически.',
        color: 'green',
      })
    } catch {
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось добавить канал. Проверьте URL и попробуйте снова.',
        color: 'red',
      })
    }
  })

  const resolved = resolveUrl.data
  const ResolvedIcon = resolved ? platformConfig[resolved.platform]?.icon : null

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Добавить канал"
      centered
      overlayProps={{ backgroundOpacity: 0.6, blur: 8 }}
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="URL канала"
            placeholder="https://youtube.com/@channel"
            description="YouTube, Telegram, Instagram или VK"
            key={form.key('url')}
            {...form.getInputProps('url')}
            onBlur={async () => {
              const url = form.getValues().url
              if (url && /^https?:\/\/.+/.test(url)) {
                try {
                  await resolveUrl.mutateAsync(url)
                } catch {
                  /* resolve is optional preview */
                }
              }
            }}
          />

          {resolved && ResolvedIcon && (
            <Group gap="sm">
              <ThemeIcon
                size="sm"
                variant="light"
                color={platformConfig[resolved.platform].color}
              >
                <ResolvedIcon size={14} />
              </ThemeIcon>
              <Text size="sm" c="dimmed">
                {platformConfig[resolved.platform].label}
                {resolved.handle ? ` · ${resolved.handle}` : ''}
              </Text>
            </Group>
          )}

          <Group justify="flex-end">
            <Button variant="default" onClick={handleClose}>
              Отмена
            </Button>
            <Button
              type="submit"
              loading={addCompetitor.isPending}
            >
              Добавить
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
