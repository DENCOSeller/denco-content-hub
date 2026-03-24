'use client'

import { useState, useEffect } from 'react'
import {
  Stack,
  Button,
  Text,
  Pagination,
  Group,
  SegmentedControl,
  SimpleGrid,
} from '@mantine/core'
import { IconPlus, IconLayoutGrid, IconList } from '@tabler/icons-react'
import Link from 'next/link'
import { useParams, useSearchParams, useRouter, usePathname } from 'next/navigation'

import { PageHeader } from '@denco/ui'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { useLibraryItemsQuery } from '@/api/hooks/useLibrary'
import { AppBreadcrumbs } from '@/components/shared/Breadcrumbs'
import { LibraryItemCard } from '@/components/features/library/LibraryItemCard'
import { LibraryFilters } from '@/components/features/library/LibraryFilters'
import { LibrarySkeleton } from '@/components/features/library/LibrarySkeleton'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { pluralize } from '@/utils/pluralize'
import type { Platform, ContentType, LibraryStatus } from '@/api/client/types.gen'

import styles from './library.module.css'

export default function WorkspaceLibraryPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const workspaceId = Number(params.id)
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)

  const page = Number(searchParams.get('page')) || 1
  const platformFilter = (searchParams.get('platform') as Platform) || null
  const contentTypeFilter = (searchParams.get('content_type') as ContentType) || null
  const statusFilter = (searchParams.get('status') as LibraryStatus) || null
  const [searchValue, setSearchValue] = useState(searchParams.get('search') ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState(searchValue)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')

  const updateSearchParams = (updates: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '') {
        newParams.delete(key)
      } else {
        newParams.set(key, value)
      }
    }
    router.push(`${pathname}?${newParams.toString()}`)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchValue)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchValue])

  useEffect(() => {
    updateSearchParams({ search: debouncedSearch || null, page: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  const breadcrumbs = [
    { label: activeWorkspace?.company_name ?? '' },
    { label: activeWorkspace?.name ?? '', href: `/workspaces/${workspaceId}` },
    { label: 'Библиотека' },
  ]

  const {
    data: libraryData,
    isLoading,
    isError,
    refetch,
  } = useLibraryItemsQuery(workspaceId, {
    page,
    size: 20,
    platform: platformFilter,
    content_type: contentTypeFilter,
    status: statusFilter,
    search: debouncedSearch || null,
  })

  const handlePlatformChange = (value: Platform | null) => {
    updateSearchParams({ platform: value, page: null })
  }

  const handleContentTypeChange = (value: ContentType | null) => {
    updateSearchParams({ content_type: value, page: null })
  }

  const handleStatusChange = (value: LibraryStatus | null) => {
    updateSearchParams({ status: value, page: null })
  }

  const handlePageChange = (newPage: number) => {
    updateSearchParams({ page: String(newPage) })
  }

  return (
    <Stack gap="lg">
      <AppBreadcrumbs items={breadcrumbs} />

      <PageHeader
        title="Библиотека"
        actions={[
          <Button
            key="create"
            leftSection={<IconPlus size={16} />}
            component={Link}
            href={`/workspaces/${workspaceId}/library/create`}
          >
            Создать
          </Button>,
        ]}
      />

      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <LibraryFilters
          platform={platformFilter}
          contentType={contentTypeFilter}
          status={statusFilter}
          search={searchValue}
          onPlatformChange={handlePlatformChange}
          onContentTypeChange={handleContentTypeChange}
          onStatusChange={handleStatusChange}
          onSearchChange={setSearchValue}
        />
        <SegmentedControl
          size="xs"
          value={viewMode}
          onChange={(v) => setViewMode(v as 'grid' | 'list')}
          data={[
            { value: 'list', label: <IconList size={16} /> },
            { value: 'grid', label: <IconLayoutGrid size={16} /> },
          ]}
          className={styles.viewToggle}
        />
      </Group>

      {isLoading && <LibrarySkeleton viewMode={viewMode} />}
      {isError && <ErrorState message="Не удалось загрузить библиотеку" onRetry={refetch} />}
      {!isLoading && !isError && (!libraryData || libraryData.items.length === 0) && (
        <EmptyState message="Нет контента. Нажмите «Создать» для начала." />
      )}

      {libraryData && libraryData.items.length > 0 && (
        <Stack gap="sm">
          <Text className={styles.sectionTitle} px="sm">
            {libraryData.total} {pluralize(libraryData.total, 'элемент', 'элемента', 'элементов')}
          </Text>

          {viewMode === 'grid' ? (
            <SimpleGrid cols={{ base: 1, xs: 2, md: 3 }} spacing="md">
              {libraryData.items.map((item) => (
                <LibraryItemCard
                  key={item.id}
                  item={item}
                  workspaceId={workspaceId}
                  viewMode="grid"
                />
              ))}
            </SimpleGrid>
          ) : (
            libraryData.items.map((item) => (
              <LibraryItemCard
                key={item.id}
                item={item}
                workspaceId={workspaceId}
                viewMode="list"
              />
            ))
          )}
        </Stack>
      )}

      {libraryData && libraryData.pages > 1 && (
        <Group justify="center">
          <Pagination
            total={libraryData.pages}
            value={page}
            onChange={handlePageChange}
          />
        </Group>
      )}
    </Stack>
  )
}
