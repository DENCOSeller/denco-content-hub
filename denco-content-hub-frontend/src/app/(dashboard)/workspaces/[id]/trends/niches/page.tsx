'use client'

import { useState } from 'react'
import {
  Stack,
  Title,
  Group,
  Button,
  SimpleGrid,
  Paper,
  Text,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconPlus, IconCategory, IconActivity, IconTrendingUp } from '@tabler/icons-react'
import { useParams } from 'next/navigation'

import { useTrendNichesQuery } from '@/api/hooks/useTrends'
import type { TrendNiche } from '@/api/types/trend'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { EmptyState } from '@/components/shared/EmptyState'
import { AppBreadcrumbs } from '@/components/shared/Breadcrumbs'
import { NicheCard } from '@/components/features/trends/NicheCard'
import { NicheFormModal } from '@/components/features/trends/NicheFormModal'
import { useWorkspaceStore } from '@/stores/workspace-store'

export default function TrendNichesPage() {
  const params = useParams()
  const workspaceId = Number(params.id)
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)

  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false)
  const [editingNiche, setEditingNiche] = useState<TrendNiche | null>(null)

  const {
    data: nichesData,
    isLoading,
    isError,
    refetch,
  } = useTrendNichesQuery(workspaceId, 1, 100)

  const niches = nichesData?.items ?? []
  const totalCount = niches.length
  const activeCount = niches.filter((n) => n.is_active).length

  function handleCreate() {
    setEditingNiche(null)
    openModal()
  }

  function handleEdit(niche: TrendNiche) {
    setEditingNiche(niche)
    openModal()
  }

  const breadcrumbs = [
    { label: activeWorkspace?.company_name ?? '', href: '/dashboard' },
    { label: activeWorkspace?.name ?? '', href: `/workspaces/${workspaceId}` },
    { label: 'Тренды', href: `/workspaces/${workspaceId}/trends` },
    { label: 'Ниши' },
  ]

  const stats = [
    { label: 'Всего ниш', value: totalCount, icon: IconCategory, color: 'blue' },
    { label: 'Активных', value: activeCount, icon: IconActivity, color: 'green' },
    { label: 'Неактивных', value: totalCount - activeCount, icon: IconTrendingUp, color: 'violet' },
  ]

  return (
    <Stack gap="lg">
      <AppBreadcrumbs items={breadcrumbs} />

      <Group justify="space-between" align="center">
        <Title order={2}>Управление нишами</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={handleCreate}>
          Добавить нишу
        </Button>
      </Group>

      <Group gap="sm" grow>
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Paper
              key={stat.label}
              p="md"
              radius="md"
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Group gap="sm">
                <Icon size={20} style={{ color: `var(--mantine-color-${stat.color}-5)` }} />
                <Stack gap={0}>
                  <Text size="xs" c="dimmed">{stat.label}</Text>
                  <Text fw={700} size="lg">{stat.value}</Text>
                </Stack>
              </Group>
            </Paper>
          )
        })}
      </Group>

      {isLoading && <LoadingState />}
      {isError && <ErrorState onRetry={refetch} />}
      {!isLoading && !isError && niches.length === 0 && (
        <EmptyState message="Нет ниш. Нажмите «Добавить нишу» для создания первой." />
      )}

      {!isLoading && !isError && niches.length > 0 && (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {niches.map((niche) => (
            <NicheCard
              key={niche.id}
              niche={niche}
              workspaceId={workspaceId}
              onEdit={handleEdit}
            />
          ))}
        </SimpleGrid>
      )}

      <NicheFormModal
        opened={modalOpened}
        onClose={closeModal}
        workspaceId={workspaceId}
        niche={editingNiche}
      />
    </Stack>
  )
}
