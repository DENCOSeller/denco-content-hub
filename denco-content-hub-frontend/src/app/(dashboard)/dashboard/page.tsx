'use client'

import { Title, Stack, Group, Button, SimpleGrid } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconPlus } from '@tabler/icons-react'
import { useState } from 'react'

import { useWorkspacesQuery } from '@/api/hooks/useWorkspaces'
import { WorkspaceCard } from '@/components/features/workspace/WorkspaceCard'
import { CreateWorkspaceModal } from '@/components/features/workspace/CreateWorkspaceModal'
import { EditWorkspaceModal } from '@/components/features/workspace/EditWorkspaceModal'
import { DeleteWorkspaceModal } from '@/components/features/workspace/DeleteWorkspaceModal'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { EmptyState } from '@/components/shared/EmptyState'
import { useSetAiPageContext } from '@/contexts/AiPageContext'
import type { WorkspaceResponse } from '@/api/client/types.gen'

import styles from '../dashboard.module.css'

export default function DashboardPage() {
  useSetAiPageContext({ page_type: 'dashboard' })
  const { data: workspaces, isLoading, isError, refetch } = useWorkspacesQuery()
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false)
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false)
  const [deleteOpened, { open: openDelete, close: closeDelete }] = useDisclosure(false)
  const [selected, setSelected] = useState<WorkspaceResponse | null>(null)

  const handleEdit = (workspace: WorkspaceResponse) => {
    setSelected(workspace)
    openEdit()
  }

  const handleDelete = (workspace: WorkspaceResponse) => {
    setSelected(workspace)
    openDelete()
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <Title order={2} className={styles.gradientText}>
          Воркспейсы
        </Title>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          Создать воркспейс
        </Button>
      </Group>

      {isLoading && <LoadingState />}
      {isError && <ErrorState onRetry={refetch} />}
      {!isLoading && !isError && (!workspaces || workspaces.length === 0) && (
        <EmptyState message="Нет воркспейсов" />
      )}

      {workspaces && workspaces.length > 0 && (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {workspaces.map((workspace) => (
            <WorkspaceCard
              key={workspace.id}
              workspace={workspace}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </SimpleGrid>
      )}

      <CreateWorkspaceModal opened={createOpened} onClose={closeCreate} />
      <EditWorkspaceModal workspace={selected} opened={editOpened} onClose={closeEdit} />
      <DeleteWorkspaceModal workspace={selected} opened={deleteOpened} onClose={closeDelete} />
    </Stack>
  )
}
