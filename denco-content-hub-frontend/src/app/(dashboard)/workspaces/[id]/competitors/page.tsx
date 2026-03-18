'use client'

import { Stack, Title, Group, Button } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconPlus } from '@tabler/icons-react'
import { useParams } from 'next/navigation'

import { useCompetitorsQuery } from '@/api/hooks/useCompetitors'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useSetAiPageContext } from '@/contexts/AiPageContext'
import { AppBreadcrumbs } from '@/components/shared/Breadcrumbs'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { EmptyState } from '@/components/shared/EmptyState'
import { ChannelCard } from '@/components/features/competitors/ChannelCard'
import { AddChannelModal } from '@/components/features/competitors/AddChannelModal'

export default function CompetitorsPage() {
  const params = useParams()
  const workspaceId = Number(params.id)
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)
  const [addOpened, { open: openAdd, close: closeAdd }] = useDisclosure(false)

  useSetAiPageContext({
    page_type: 'workspace',
    workspace_id: workspaceId,
    workspace_name: activeWorkspace?.name,
  })

  const { data, isLoading, isError, refetch } = useCompetitorsQuery(workspaceId)

  const breadcrumbs = [
    { label: activeWorkspace?.company_name ?? '', href: '/' },
    { label: activeWorkspace?.name ?? '', href: `/workspaces/${workspaceId}` },
    { label: 'Мониторинг' },
  ]

  if (isLoading) return <LoadingState message="Загрузка каналов..." />
  if (isError) return <ErrorState onRetry={refetch} />

  return (
    <Stack>
      <AppBreadcrumbs items={breadcrumbs} />

      <Group justify="space-between" align="center">
        <Title order={2}>Мониторинг</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={openAdd}>
          Добавить канал
        </Button>
      </Group>

      {!data?.items.length ? (
        <EmptyState message="Каналы не добавлены. Нажмите «Добавить канал» чтобы начать мониторинг." />
      ) : (
        <Stack gap="md">
          {data.items.map((channel) => (
            <ChannelCard key={channel.id} channel={channel} workspaceId={workspaceId} />
          ))}
        </Stack>
      )}

      <AddChannelModal
        opened={addOpened}
        onClose={closeAdd}
        workspaceId={workspaceId}
      />
    </Stack>
  )
}
