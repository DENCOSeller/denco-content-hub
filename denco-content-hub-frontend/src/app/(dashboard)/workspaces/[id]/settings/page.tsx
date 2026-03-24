'use client'

import { Stack, Tabs, rem } from '@mantine/core'
import { useParams } from 'next/navigation'
import { IconUsers, IconMail, IconSettings } from '@tabler/icons-react'

import { PageHeader } from '@denco/ui'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { AppBreadcrumbs } from '@/components/shared/Breadcrumbs'
import { TeamTab } from '@/components/features/settings/TeamTab'
import { InvitationsTab } from '@/components/features/settings/InvitationsTab'
import { ContentSettingsTab } from '@/components/features/settings/ContentSettingsTab'

import styles from './settings.module.css'

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
      <PageHeader title="Настройки" subtitle="Управление командой, приглашениями и контентом" />

      <Tabs defaultValue="team" keepMounted={false} classNames={{ list: styles.tabsList, tab: styles.tab }}>
        <Tabs.List mb="lg">
          <Tabs.Tab
            value="team"
            leftSection={<IconUsers style={{ width: rem(16), height: rem(16) }} />}
          >
            Команда
          </Tabs.Tab>
          <Tabs.Tab
            value="invitations"
            leftSection={<IconMail style={{ width: rem(16), height: rem(16) }} />}
          >
            Приглашения
          </Tabs.Tab>
          <Tabs.Tab
            value="content"
            leftSection={<IconSettings style={{ width: rem(16), height: rem(16) }} />}
          >
            Контент
          </Tabs.Tab>
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
