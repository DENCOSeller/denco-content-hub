'use client'

import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import { Stack, Title } from '@mantine/core'

import { useWorkspaceStore } from '@/stores/workspace-store'
import { AppBreadcrumbs } from '@/components/shared/Breadcrumbs'
import { LoadingState } from '@/components/shared/LoadingState'
import { useSetAiPageContext } from '@/contexts/AiPageContext'

const KnowledgeGraph = dynamic(
  () => import('@/components/knowledge/KnowledgeGraph').then((m) => m.KnowledgeGraph),
  { ssr: false, loading: () => <LoadingState /> },
)

export default function KnowledgeGraphPage() {
  const params = useParams()
  const workspaceId = Number(params.id)
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)

  useSetAiPageContext({
    page_type: 'workspace_knowledge',
    workspace_id: workspaceId,
  })

  const breadcrumbs = [
    { label: activeWorkspace?.company_name ?? '' },
    { label: activeWorkspace?.name ?? '', href: `/workspaces/${workspaceId}` },
    { label: 'Граф знаний' },
  ]

  return (
    <Stack gap="md">
      <AppBreadcrumbs items={breadcrumbs} />
      <Title order={2}>Граф знаний</Title>
      <KnowledgeGraph scope="workspace" scopeId={workspaceId} />
    </Stack>
  )
}
