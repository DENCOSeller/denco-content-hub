'use client'

import { useState } from 'react'
import {
  Modal,
  Stack,
  Text,
  TextInput,
  Textarea,
  Button,
  Group,
  UnstyledButton,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useMediaQuery } from '@mantine/hooks'
import { zod4Resolver } from 'mantine-form-zod-resolver'
import { Dropzone, MIME_TYPES } from '@mantine/dropzone'
import { notifications } from '@mantine/notifications'
import {
  IconBrandYoutube,
  IconFileTypePdf,
  IconWorld,
  IconFileText,
  IconUpload,
  IconX,
  IconFile,
} from '@tabler/icons-react'

import { useAddSourceMutation } from '@/api/hooks/useContent'
import type { SourceType } from '@/api/source'
import {
  youtubeSourceSchema,
  webPageSourceSchema,
  manualTextSourceSchema,
} from '@/lib/validations/content'

import styles from './AddSourceModal.module.css'

interface AddSourceModalProps {
  workspaceId: number
  opened: boolean
  onClose: () => void
}

const SOURCE_TYPES: { type: SourceType; label: string; icon: typeof IconBrandYoutube }[] = [
  { type: 'youtube_video', label: 'YouTube', icon: IconBrandYoutube },
  { type: 'pdf_file', label: 'PDF', icon: IconFileTypePdf },
  { type: 'web_page', label: 'Веб-страница', icon: IconWorld },
  { type: 'manual_text', label: 'Текст', icon: IconFileText },
]

export function AddSourceModal({ workspaceId, opened, onClose }: AddSourceModalProps) {
  const [sourceType, setSourceType] = useState<SourceType>('youtube_video')
  const [pdfFile, setPdfFile] = useState<File | null>(null)

  const isMobile = useMediaQuery('(max-width: 48em)')
  const addSource = useAddSourceMutation(workspaceId)

  const youtubeForm = useForm({
    mode: 'uncontrolled',
    initialValues: { url: '' },
    validate: zod4Resolver(youtubeSourceSchema),
  })

  const webPageForm = useForm({
    mode: 'uncontrolled',
    initialValues: { url: '' },
    validate: zod4Resolver(webPageSourceSchema),
  })

  const manualForm = useForm({
    mode: 'uncontrolled',
    initialValues: { title: '', text: '' },
    validate: zod4Resolver(manualTextSourceSchema),
  })

  function resetAll() {
    setSourceType('youtube_video')
    setPdfFile(null)
    youtubeForm.reset()
    webPageForm.reset()
    manualForm.reset()
  }

  function handleClose() {
    resetAll()
    onClose()
  }

  async function handleSuccess() {
    notifications.show({
      title: 'Добавлено',
      message: 'Источник отправлен на обработку',
      color: 'green',
    })
    handleClose()
  }

  function handleError(err: unknown) {
    const message =
      err && typeof err === 'object' && 'detail' in err
        ? String((err as { detail: string }).detail)
        : 'Не удалось добавить источник'
    notifications.show({ title: 'Ошибка', message, color: 'red' })
  }

  async function submitYoutube() {
    const validation = youtubeForm.validate()
    if (validation.hasErrors) return
    try {
      await addSource.mutateAsync({
        source_type: 'youtube_video',
        url: youtubeForm.getValues().url,
      })
      await handleSuccess()
    } catch (err: unknown) {
      handleError(err)
    }
  }

  async function submitWebPage() {
    const validation = webPageForm.validate()
    if (validation.hasErrors) return
    try {
      await addSource.mutateAsync({
        source_type: 'web_page',
        url: webPageForm.getValues().url,
      })
      await handleSuccess()
    } catch (err: unknown) {
      handleError(err)
    }
  }

  async function submitPdf() {
    if (!pdfFile) {
      notifications.show({
        title: 'Ошибка',
        message: 'Выберите PDF-файл',
        color: 'red',
      })
      return
    }
    try {
      await addSource.mutateAsync({
        source_type: 'pdf_file',
        file: pdfFile,
      })
      await handleSuccess()
    } catch (err: unknown) {
      handleError(err)
    }
  }

  async function submitManualText() {
    const validation = manualForm.validate()
    if (validation.hasErrors) return
    const values = manualForm.getValues()
    try {
      await addSource.mutateAsync({
        source_type: 'manual_text',
        title: values.title,
        text: values.text,
      })
      await handleSuccess()
    } catch (err: unknown) {
      handleError(err)
    }
  }

  function handleSubmit() {
    switch (sourceType) {
      case 'youtube_video': return submitYoutube()
      case 'web_page': return submitWebPage()
      case 'pdf_file': return submitPdf()
      case 'manual_text': return submitManualText()
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Добавить источник"
      size="lg"
      fullScreen={isMobile}
      centered={!isMobile}
      className={styles.modal}
      overlayProps={{ backgroundOpacity: 0.6, blur: 8 }}
    >
      <Stack gap="lg">
        {/* Type picker */}
        <div>
          <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb="xs">
            Тип источника
          </Text>
          <div className={styles.typeGrid}>
            {SOURCE_TYPES.map(({ type, label, icon: Icon }) => {
              const isSelected = sourceType === type
              return (
                <UnstyledButton
                  key={type}
                  onClick={() => setSourceType(type)}
                  className={`${styles.typeCard} ${isSelected ? styles.typeCardSelected : ''}`}
                >
                  <Icon size={24} stroke={1.5} />
                  <span className={`${styles.typeLabel} ${isSelected ? styles.typeLabelSelected : ''}`}>
                    {label}
                  </span>
                </UnstyledButton>
              )
            })}
          </div>
        </div>

        {/* Forms per type */}
        {sourceType === 'youtube_video' && (
          <TextInput
            label="YouTube URL"
            placeholder="https://www.youtube.com/watch?v=..."
            key={youtubeForm.key('url')}
            {...youtubeForm.getInputProps('url')}
          />
        )}

        {sourceType === 'web_page' && (
          <TextInput
            label="URL веб-страницы"
            placeholder="https://example.com/article"
            key={webPageForm.key('url')}
            {...webPageForm.getInputProps('url')}
          />
        )}

        {sourceType === 'pdf_file' && (
          <div>
            {pdfFile ? (
              <div className={styles.selectedFile}>
                <IconFile size={20} />
                <Text size="sm" style={{ flex: 1 }} truncate>
                  {pdfFile.name}
                </Text>
                <UnstyledButton onClick={() => setPdfFile(null)}>
                  <IconX size={16} />
                </UnstyledButton>
              </div>
            ) : (
              <Dropzone
                onDrop={(files) => setPdfFile(files[0])}
                onReject={() =>
                  notifications.show({
                    title: 'Ошибка',
                    message: 'Файл слишком большой или неверный формат. Максимум 50 МБ, только PDF.',
                    color: 'red',
                  })
                }
                accept={[MIME_TYPES.pdf]}
                maxSize={50 * 1024 * 1024}
                maxFiles={1}
                className={styles.dropzone}
                classNames={{
                  inner: styles.dropzoneInner,
                }}
              >
                <Stack align="center" justify="center" gap="xs" mih={100}>
                  <Dropzone.Accept>
                    <IconUpload size={32} stroke={1.5} />
                  </Dropzone.Accept>
                  <Dropzone.Reject>
                    <IconX size={32} stroke={1.5} color="var(--mantine-color-red-6)" />
                  </Dropzone.Reject>
                  <Dropzone.Idle>
                    <IconFileTypePdf size={32} stroke={1.5} opacity={0.5} />
                  </Dropzone.Idle>
                  <Text size="sm" c="dimmed" ta="center">
                    Перетащите PDF-файл или нажмите для выбора
                  </Text>
                </Stack>
              </Dropzone>
            )}
          </div>
        )}

        {sourceType === 'manual_text' && (
          <Stack gap="sm">
            <TextInput
              label="Заголовок"
              placeholder="Название источника"
              key={manualForm.key('title')}
              {...manualForm.getInputProps('title')}
            />
            <Textarea
              label="Текст"
              placeholder="Введите текст источника..."
              minRows={4}
              maxRows={8}
              autosize
              key={manualForm.key('text')}
              {...manualForm.getInputProps('text')}
            />
          </Stack>
        )}

        {/* Actions */}
        <Group justify="flex-end">
          <Button variant="subtle" onClick={handleClose}>
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            loading={addSource.isPending}
          >
            Добавить
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
