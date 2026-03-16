'use client'

import { Stack, Title, SimpleGrid } from '@mantine/core'
import { IconSearch, IconSettings, IconShare } from '@tabler/icons-react'
import { useParams } from 'next/navigation'

import { useWorkspaceStore } from '@/stores/workspace-store'
import { AppBreadcrumbs } from '@/components/shared/Breadcrumbs'
import { SectionCard } from '@/components/features/workspace/SectionCard'
import { useSetAiPageContext } from '@/contexts/AiPageContext'

export default function WorkspaceHubPage() {
  const params = useParams()
  const workspaceId = params.id as string
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)

  useSetAiPageContext({
    page_type: 'workspace',
    workspace_id: Number(workspaceId),
    workspace_name: activeWorkspace?.name,
  })

  const breadcrumbs = [
    { label: activeWorkspace?.company_name ?? '' },
    { label: activeWorkspace?.name ?? '' },
  ]

  return (
    <Stack>
      <AppBreadcrumbs items={breadcrumbs} />
      <Title order={2}>{activeWorkspace?.name}</Title>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <SectionCard
          title="Референсы"
          description="Контент воркспейса"
          icon={IconSearch}
          href={`/workspaces/${workspaceId}/references`}
        />
        <SectionCard
          title="Граф знаний"
          description="Визуальная карта знаний"
          icon={IconShare}
          href={`/workspaces/${workspaceId}/knowledge`}
        />
        <SectionCard
          title="Настройки"
          description="Управление воркспейсом"
          icon={IconSettings}
          href={`/workspaces/${workspaceId}/settings`}
        />
      </SimpleGrid>
    </Stack>
  )
}
