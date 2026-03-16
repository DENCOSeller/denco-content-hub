'use client'

import { useState } from 'react'
import {
  Title,
  Stack,
  Group,
  TextInput,
  Button,
  Text,
  ActionIcon,
  Pagination,
  SegmentedControl,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconPlus, IconSearch, IconX } from '@tabler/icons-react'
import { useParams, useSearchParams, useRouter, usePathname } from 'next/navigation'

import { useContentListQuery } from '@/api/hooks/useContent'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { EmptyState } from '@/components/shared/EmptyState'
import { AppBreadcrumbs } from '@/components/shared/Breadcrumbs'
import { ContentRow } from '@/components/features/references/ContentRow'
import { AddSourceModal } from '@/components/features/references/AddSourceModal'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { ContentItemShortResponse } from '@/api/client/types.gen'

import styles from './references.module.css'

type ContentStatus = 'pending' | 'processing' | 'completed' | 'failed'

type ContentItemWithProcessingStep = ContentItemShortResponse & {
  processing_step?: string | null
}

export default function WorkspaceReferencesPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const workspaceId = Number(params.id)
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)

  const page = Number(searchParams.get('page')) || 1
  const statusFilter = (searchParams.get('status') as ContentStatus) || null
  const [searchValue, setSearchValue] = useState(
    searchParams.get('search') ?? '',
  )

  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false)

  const basePath = `/workspaces/${workspaceId}/references`

  const breadcrumbs = [
    { label: activeWorkspace?.company_name ?? '' },
    { label: activeWorkspace?.name ?? '', href: `/workspaces/${workspaceId}` },
    { label: 'Референсы' },
  ]

  const {
    data: contentData,
    isLoading,
    isError,
    refetch,
  } = useContentListQuery({
    workspaceId,
    page,
    size: 20,
    status: statusFilter,
    search: searchValue || null,
  })

  const updateSearchParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  const handleStatusChange = (value: string) => {
    updateSearchParams({
      status: value === 'all' ? null : value,
      page: null,
    })
  }

  const handleSearch = () => {
    updateSearchParams({
      search: searchValue || null,
      page: null,
    })
  }

  const handlePageChange = (newPage: number) => {
    updateSearchParams({ page: String(newPage) })
  }

  return (
    <Stack gap="lg">
      <AppBreadcrumbs items={breadcrumbs} />

      <Group justify="space-between" align="center">
        <Title order={2} className={styles.pageTitle}>
          Референсы
        </Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={openModal}
        >
          Добавить источник
        </Button>
      </Group>

      <AddSourceModal
        workspaceId={workspaceId}
        opened={modalOpened}
        onClose={closeModal}
      />

      {/* Filters */}
      <Group justify="space-between" align="flex-end">
        <SegmentedControl
          value={statusFilter ?? 'all'}
          onChange={handleStatusChange}
          data={[
            { label: 'Все', value: 'all' },
            { label: 'Ожидает', value: 'pending' },
            { label: 'Обработка', value: 'processing' },
            { label: 'Готово', value: 'completed' },
            { label: 'Ошибка', value: 'failed' },
          ]}
          size="xs"
        />

        <Group gap="xs">
          <TextInput
            placeholder="Поиск по названию..."
            size="xs"
            value={searchValue}
            onChange={(e) => setSearchValue(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            rightSection={
              searchValue ? (
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={() => {
                    setSearchValue('')
                    updateSearchParams({ search: null, page: null })
                  }}
                >
                  <IconX size={14} />
                </ActionIcon>
              ) : (
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={handleSearch}
                >
                  <IconSearch size={14} />
                </ActionIcon>
              )
            }
          />
        </Group>
      </Group>

      {/* Content list */}
      {isLoading && <LoadingState />}
      {isError && <ErrorState onRetry={refetch} />}
      {!isLoading && !isError && (!contentData || contentData.items.length === 0) && (
        <EmptyState message="Нет источников. Нажмите «Добавить источник» для начала." />
      )}

      {contentData && contentData.items.length > 0 && (
        <Stack gap="sm">
          <Text className={styles.sectionTitle} px="sm">
            {contentData.total} элементов
          </Text>
          {contentData.items.map((item) => (
            <ContentRow
              key={item.id}
              item={item as ContentItemWithProcessingStep}
              workspaceId={workspaceId}
              basePath={basePath}
            />
          ))}
        </Stack>
      )}

      {/* Pagination */}
      {contentData && contentData.pages > 1 && (
        <Group justify="center">
          <Pagination
            total={contentData.pages}
            value={page}
            onChange={handlePageChange}
          />
        </Group>
      )}
    </Stack>
  )
}
