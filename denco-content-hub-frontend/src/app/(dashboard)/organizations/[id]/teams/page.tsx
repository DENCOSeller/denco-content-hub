'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Stack, Text, Button } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconPlus } from '@tabler/icons-react'

import { PageHeader } from '@denco/ui'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { pluralize } from '@/utils/pluralize'
import { useOrganizationStore } from '@/stores/organization-store'
import { useSetAiPageContext } from '@/contexts/AiPageContext'
import { AppBreadcrumbs } from '@/components/shared/Breadcrumbs'
import { LoadingState } from '@/components/shared/LoadingState'

import { useStaffTeamsQuery } from '@/api/hooks/useStaffTeams'
import type { StaffTeam } from '@/api/hooks/useStaffTeams'

import {
  CreateTeamModal,
  EditTeamModal,
  DeleteTeamModal,
  TeamCard,
  TeamDetailPanel,
} from '@/components/features/organizations/teams'

import styles from './teams.module.css'

export default function TeamsPage() {
  const params = useParams()
  const orgId = Number(params.id)
  const activeOrganization = useOrganizationStore((s) => s.activeOrganization)

  useSetAiPageContext({ page_type: 'dashboard', company_id: orgId })

  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false)
  const [editTeam, setEditTeam] = useState<StaffTeam | null>(null)
  const [deleteTeam, setDeleteTeam] = useState<StaffTeam | null>(null)

  const { data, isLoading, isError, refetch } = useStaffTeamsQuery(orgId)

  const breadcrumbs = [
    { label: 'Организации', href: '/organizations' },
    { label: activeOrganization?.name ?? 'Организация', href: `/organizations/${orgId}` },
    { label: 'Команды' },
  ]

  // If a team is selected, show detail
  if (selectedTeamId) {
    return (
      <Stack gap="md">
        <AppBreadcrumbs items={[...breadcrumbs, { label: 'Детали' }]} />
        <TeamDetailPanel
          orgId={orgId}
          teamId={selectedTeamId}
          onBack={() => setSelectedTeamId(null)}
        />
      </Stack>
    )
  }

  return (
    <Stack gap="lg">
      <AppBreadcrumbs items={breadcrumbs} />

      <PageHeader
        title="Команды"
        subtitle="Управление командами организации"
        actions={[
          <Button key="create" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Создать команду
          </Button>,
        ]}
      />

      {isLoading && <LoadingState message="Загрузка команд..." />}
      {isError && <ErrorState message="Не удалось загрузить команды" onRetry={refetch} />}

      {!isLoading && !isError && (!data || data.items.length === 0) && (
        <EmptyState message="Команды не созданы. Создайте первую команду для организации." />
      )}

      {data && data.items.length > 0 && (
        <Stack gap="sm">
          <Text className={styles.sectionTitle} px="sm">
            {data.total} {pluralize(data.total, 'команда', 'команды', 'команд')}
          </Text>
          {data.items.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              onEdit={setEditTeam}
              onDelete={setDeleteTeam}
              onSelect={(t) => setSelectedTeamId(t.id)}
            />
          ))}
        </Stack>
      )}

      <CreateTeamModal opened={createOpened} onClose={closeCreate} orgId={orgId} />
      <EditTeamModal team={editTeam} onClose={() => setEditTeam(null)} orgId={orgId} />
      <DeleteTeamModal team={deleteTeam} onClose={() => setDeleteTeam(null)} orgId={orgId} />
    </Stack>
  )
}
