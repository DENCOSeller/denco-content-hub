'use client'

import { Stack, Title, Tabs } from '@mantine/core'
import { useParams } from 'next/navigation'

import { useWorkspaceStore } from '@/stores/workspace-store'
import { AppBreadcrumbs } from '@/components/shared/Breadcrumbs'
import { TeamTab } from '@/components/features/settings/TeamTab'
import { InvitationsTab } from '@/components/features/settings/InvitationsTab'
import { ContentSettingsTab } from '@/components/features/settings/ContentSettingsTab'

export default function WorkspaceSettingsPage() {
  const params = useParams()
  const workspaceId = Number(params.id)
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)

  const breadcrumbs = [
    { label: activeWorkspace?.company_name ?? '' },
    { label: activeWorkspace?.name ?? '', href: `/workspaces/${workspaceId}` },
    { label: 'Настройки' },
  ]

  return (
    <Stack gap="lg">
      <AppBreadcrumbs items={breadcrumbs} />
      <Title order={2}>Настройки</Title>

      <Tabs defaultValue="team" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="team">Команда</Tabs.Tab>
          <Tabs.Tab value="invitations">Приглашения</Tabs.Tab>
          <Tabs.Tab value="content">Контент</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="team">
          <TeamTab workspaceId={workspaceId} />
        </Tabs.Panel>

        <Tabs.Panel value="invitations">
          <InvitationsTab workspaceId={workspaceId} />
        </Tabs.Panel>

        <Tabs.Panel value="content">
          <ContentSettingsTab workspaceId={workspaceId} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
