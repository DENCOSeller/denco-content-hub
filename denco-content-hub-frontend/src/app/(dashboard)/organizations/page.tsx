'use client'

import { useEffect, useState } from 'react'
import {
  Stack,
  Group,
  TextInput,
  Button,
  Text,
  ActionIcon,
  Pagination,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { IconPlus, IconSearch } from '@tabler/icons-react'

import { PageHeader } from '@denco/ui'
import {
  useOrganizationsQuery,
} from '@/api/hooks/useOrganizations'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { AppBreadcrumbs } from '@/components/shared/Breadcrumbs'
import { useAuthStore } from '@/stores/auth-store'
import { useOrganizationStore } from '@/stores/organization-store'
import { LoadingState } from '@/components/shared/LoadingState'
import {
  CreateOrganizationModal,
  EditOrganizationModal,
  DeleteOrganizationModal,
  OrganizationCard,
} from '@/components/features/organizations'
import type { OrganizationResponse } from '@/api/client/types.gen'

import styles from './organizations.module.css'

export default function OrganizationsPage() {
  const user = useAuthStore((s) => s.user)
  const setActiveOrganization = useOrganizationStore((s) => s.setActiveOrganization)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const page = Number(searchParams.get('page')) || 1
  const [searchValue, setSearchValue] = useState(searchParams.get('search') ?? '')

  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false)
  const [editOrganization, setEditOrganization] = useState<OrganizationResponse | null>(null)
  const [deleteOrganization, setDeleteOrganization] = useState<OrganizationResponse | null>(null)

  // Guard: redirect non-platform-owners
  useEffect(() => {
    if (user && !user.is_platform_owner) {
      router.replace('/dashboard')
    }
  }, [user, router])

  const { data, isLoading, isError, refetch } = useOrganizationsQuery(
    page,
    20,
    searchParams.get('search') || undefined,
  )

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

  const handleSearch = () => {
    updateSearchParams({ search: searchValue || null, page: null })
  }

  const handlePageChange = (newPage: number) => {
    updateSearchParams({ page: String(newPage) })
  }

  if (!user?.is_platform_owner) return <LoadingState />

  const breadcrumbs = [
    { label: 'Организации' },
  ]

  return (
    <Stack gap="lg">
      <AppBreadcrumbs items={breadcrumbs} />
      <PageHeader
        title="Организации"
        subtitle="Управление организациями платформы"
        actions={[
          <Button key="create" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Добавить
          </Button>,
        ]}
      />

      {/* Search */}
      <Group gap="xs">
        <TextInput
          placeholder="Поиск по названию..."
          size="sm"
          value={searchValue}
          onChange={(e) => setSearchValue(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          rightSection={
            <ActionIcon variant="subtle" size="sm" onClick={handleSearch}>
              <IconSearch size={14} />
            </ActionIcon>
          }
          className="flexFill"
        />
      </Group>

      {/* List */}
      {isLoading && <LoadingState />}
      {isError && <ErrorState onRetry={refetch} />}
      {!isLoading && !isError && (!data || data.items.length === 0) && (
        <EmptyState message="Организации не найдены" />
      )}

      {data && data.items.length > 0 && (
        <Stack gap="sm">
          <Text className={styles.sectionTitle} px="sm">
            {data.total} организаций
          </Text>
          {data.items.map((organization) => (
            <OrganizationCard
              key={organization.id}
              organization={organization}
              onEdit={setEditOrganization}
              onDelete={setDeleteOrganization}
              onKnowledge={(o) => {
                setActiveOrganization({ id: o.id, name: o.name, slug: o.slug })
                router.push(`/organizations/${o.id}/knowledge`)
              }}
            />
          ))}
        </Stack>
      )}

      {/* Pagination */}
      {data && data.pages > 1 && (
        <Group justify="center">
          <Pagination
            total={data.pages}
            value={page}
            onChange={handlePageChange}
          />
        </Group>
      )}

      {/* Modals */}
      <CreateOrganizationModal opened={createOpened} onClose={closeCreate} />
      <EditOrganizationModal organization={editOrganization} onClose={() => setEditOrganization(null)} />
      <DeleteOrganizationModal organization={deleteOrganization} onClose={() => setDeleteOrganization(null)} />
    </Stack>
  )
}
