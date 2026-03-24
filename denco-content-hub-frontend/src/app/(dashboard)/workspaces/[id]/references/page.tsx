'use client'

import { useState } from 'react'
import {
  Stack,
  Group,
  TextInput,
  Button,
  Text,
  ActionIcon,
  Pagination,
  SegmentedControl,
  Skeleton,
  Collapse,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconPlus, IconSearch, IconX, IconFilter } from '@tabler/icons-react'
import { useParams, useSearchParams, useRouter, usePathname } from 'next/navigation'

import { PageHeader } from '@/components/shared/PageHeader'
import { AppBreadcrumbs } from '@/components/shared/Breadcrumbs'
import { ErrorState } from '@/components/shared/ErrorState'
import { useContentListQuery } from '@/api/hooks/useContent'
import { EmptyState } from '@/components/shared/EmptyState'
import { ContentCard } from '@/components/features/references/ContentCard'
import { AddSourceModal } from '@/components/features/references/AddSourceModal'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { ContentItemShortWithYouTube } from '@/api/types/content'

import styles from './references.module.css'

type ContentStatus = 'pending' | 'processing' | 'completed' | 'failed'

type ContentItemWithProcessingStep = ContentItemShortWithYouTube & {
  processing_step?: string | null
}

function ContentCardSkeleton() {
  return (
    <div className={styles.skeletonCard}>
      <Skeleton height={0} className={styles.skeletonThumb} />
      <div className={styles.skeletonBody}>
        <Skeleton height={14} width="80%" radius="sm" />
        <Skeleton height={12} width="60%" radius="sm" mt={8} />
        <Skeleton height={12} width="40%" radius="sm" mt={6} />
      </div>
    </div>
  )
}

function ContentGridSkeleton() {
  return (
    <div className={styles.grid}>
      {Array.from({ length: 6 }).map((_, i) => (
        <ContentCardSkeleton key={i} />
      ))}
    </div>
  )
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
  const [filtersOpen, { toggle: toggleFilters }] = useDisclosure(true)

  const basePath = `/workspaces/${workspaceId}/references`

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

  const breadcrumbs = [
    { label: activeWorkspace?.company_name ?? '' },
    { label: activeWorkspace?.name ?? '', href: `/workspaces/${workspaceId}` },
    { label: 'Референсы' },
  ]

  return (
    <Stack gap="lg">
      <AppBreadcrumbs items={breadcrumbs} />
      <PageHeader
        title="Референсы"
        subtitle={activeWorkspace ? `${activeWorkspace.company_name} / ${activeWorkspace.name}` : undefined}
        actions={[
          <Button
            key="add"
            leftSection={<IconPlus size={16} />}
            size="sm"
            onClick={openModal}
          >
            Добавить источник
          </Button>,
          <Button
            key="filters"
            variant="subtle"
            size="xs"
            leftSection={<IconFilter size={14} />}
            onClick={toggleFilters}
            className={styles.filterToggle}
          >
            Фильтры
          </Button>,
        ]}
      />

      <AddSourceModal
        workspaceId={workspaceId}
        opened={modalOpened}
        onClose={closeModal}
      />

      {/* Filters — collapsible on mobile */}
      <Collapse in={filtersOpen}>
        <div className={styles.filtersBar}>
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

          <TextInput
            placeholder="Поиск по названию..."
            size="xs"
            value={searchValue}
            onChange={(e) => setSearchValue(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className={styles.searchInput}
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
        </div>
      </Collapse>

      {/* Content */}
      {isLoading && <ContentGridSkeleton />}

      {isError && (
        <ErrorState message="Ошибка загрузки контента" onRetry={refetch} />
      )}

      {!isLoading && !isError && (!contentData || contentData.items.length === 0) && (
        <EmptyState message="Нет источников. Нажмите «Добавить источник» для начала." />
      )}

      {contentData && contentData.items.length > 0 && (
        <>
          <Text className={styles.countLabel}>
            {contentData.total} элементов
          </Text>
          <div className={styles.grid}>
            {contentData.items.map((item) => (
              <ContentCard
                key={item.id}
                item={item as ContentItemWithProcessingStep}
                workspaceId={workspaceId}
                basePath={basePath}
              />
            ))}
          </div>
        </>
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
