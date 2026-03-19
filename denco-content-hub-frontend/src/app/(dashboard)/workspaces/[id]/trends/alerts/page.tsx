'use client'

import { Stack, Title, Tabs } from '@mantine/core'
import { IconBell, IconSettings } from '@tabler/icons-react'
import { useParams } from 'next/navigation'

import { useWorkspaceStore } from '@/stores/workspace-store'
import { AppBreadcrumbs } from '@/components/shared/Breadcrumbs'
import { AlertHistory } from '@/components/features/trends/AlertHistory'
import { AlertSettings } from '@/components/features/trends/AlertSettings'

export default function TrendAlertsPage() {
  const params = useParams()
  const workspaceId = Number(params.id)
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)

  const breadcrumbs = [
    { label: activeWorkspace?.company_name ?? '', href: '/dashboard' },
    { label: activeWorkspace?.name ?? '', href: `/workspaces/${workspaceId}` },
    { label: 'Тренды', href: `/workspaces/${workspaceId}/trends` },
    { label: 'Алерты' },
  ]

  return (
    <Stack gap="lg">
      <AppBreadcrumbs items={breadcrumbs} />
      <Title order={2}>Алерты трендов</Title>

      <Tabs defaultValue="history">
        <Tabs.List>
          <Tabs.Tab value="history" leftSection={<IconBell size={16} />}>
            История
          </Tabs.Tab>
          <Tabs.Tab value="settings" leftSection={<IconSettings size={16} />}>
            Настройки
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="history" pt="md">
          <AlertHistory workspaceId={workspaceId} />
        </Tabs.Panel>

        <Tabs.Panel value="settings" pt="md">
          <AlertSettings workspaceId={workspaceId} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
