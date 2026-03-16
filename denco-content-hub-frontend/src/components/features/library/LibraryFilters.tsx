'use client'

import { Group, Select, TextInput, ActionIcon } from '@mantine/core'
import { IconSearch, IconX } from '@tabler/icons-react'

import type { Platform, ContentType, LibraryStatus } from '@/api/client/types.gen'

interface LibraryFiltersProps {
  platform: Platform | null
  contentType: ContentType | null
  status: LibraryStatus | null
  search: string
  onPlatformChange: (value: Platform | null) => void
  onContentTypeChange: (value: ContentType | null) => void
  onStatusChange: (value: LibraryStatus | null) => void
  onSearchChange: (value: string) => void
}

const PLATFORM_OPTIONS = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'vk', label: 'ВКонтакте' },
]

const CONTENT_TYPE_OPTIONS = [
  { value: 'shorts', label: 'Shorts' },
  { value: 'long_video', label: 'Длинное видео' },
  { value: 'reels', label: 'Reels' },
  { value: 'post', label: 'Пост' },
  { value: 'carousel', label: 'Карусель' },
  { value: 'article', label: 'Статья' },
  { value: 'clip', label: 'Клип' },
]

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Черновик' },
  { value: 'ready', label: 'Готов' },
  { value: 'published', label: 'Опубликован' },
]

export function LibraryFilters({
  platform,
  contentType,
  status,
  search,
  onPlatformChange,
  onContentTypeChange,
  onStatusChange,
  onSearchChange,
}: LibraryFiltersProps) {
  return (
    <Group gap="sm" wrap="wrap">
      <Select
        placeholder="Платформа"
        data={PLATFORM_OPTIONS}
        value={platform}
        onChange={(v) => onPlatformChange(v as Platform | null)}
        clearable
        size="xs"
        w={150}
      />
      <Select
        placeholder="Тип контента"
        data={CONTENT_TYPE_OPTIONS}
        value={contentType}
        onChange={(v) => onContentTypeChange(v as ContentType | null)}
        clearable
        size="xs"
        w={170}
      />
      <Select
        placeholder="Статус"
        data={STATUS_OPTIONS}
        value={status}
        onChange={(v) => onStatusChange(v as LibraryStatus | null)}
        clearable
        size="xs"
        w={150}
      />
      <TextInput
        placeholder="Поиск по названию..."
        size="xs"
        value={search}
        onChange={(e) => onSearchChange(e.currentTarget.value)}
        rightSection={
          search ? (
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => onSearchChange('')}
            >
              <IconX size={14} />
            </ActionIcon>
          ) : (
            <IconSearch size={14} style={{ color: 'var(--mantine-color-dimmed)' }} />
          )
        }
        style={{ flex: 1, minWidth: 180 }}
      />
    </Group>
  )
}
