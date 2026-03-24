'use client'

import { Stack } from '@mantine/core'
import { useParams } from 'next/navigation'
import { PageHeader } from '@denco/ui'
import { AppBreadcrumbs } from '@/components/shared/Breadcrumbs'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { CreateWizard } from '@/components/features/library/create-wizard/CreateWizard'

export default function LibraryCreatePage() {
  const params = useParams()
  const workspaceId = Number(params.id)
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)

  const breadcrumbs = [
    { label: activeWorkspace?.company_name ?? '' },
    { label: activeWorkspace?.name ?? '', href: `/workspaces/${workspaceId}` },
    { label: 'Библиотека', href: `/workspaces/${workspaceId}/library` },
    { label: 'Создание контента' },
  ]

  return (
    <Stack gap="lg">
      <AppBreadcrumbs items={breadcrumbs} />
      <PageHeader title="Создание контента" />
      <CreateWizard workspaceId={workspaceId} />
    </Stack>
  )
}
