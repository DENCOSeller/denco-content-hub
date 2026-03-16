'use client'

import { Title, Stack, Group, SegmentedControl } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconCalendar, IconList } from '@tabler/icons-react'
import { useState, useCallback } from 'react'
import { useParams } from 'next/navigation'

import { AppBreadcrumbs } from '@/components/shared/Breadcrumbs'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { CalendarView } from '@/components/features/content-plan/CalendarView'
import { ListView } from '@/components/features/content-plan/ListView'
import { AddToPlanModal } from '@/components/features/content-plan/AddToPlanModal'

import styles from './content-plan.module.css'

type ViewMode = 'calendar' | 'list'

export default function ContentPlanPage() {
  const params = useParams()
  const workspaceId = Number(params.id)
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)
  const [viewMode, setViewMode] = useState<ViewMode>('calendar')
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const handleAddClick = useCallback((date: Date) => {
    setSelectedDate(date)
    openModal()
  }, [openModal])

  const breadcrumbs = [
    { label: activeWorkspace?.company_name ?? '' },
    { label: activeWorkspace?.name ?? '', href: `/workspaces/${workspaceId}` },
    { label: 'Контент-план' },
  ]

  return (
    <Stack gap="lg">
      <AppBreadcrumbs items={breadcrumbs} />

      <Group justify="space-between" align="center">
        <Title order={2} className={styles.pageTitle}>
          Контент-план
        </Title>

        <SegmentedControl
          value={viewMode}
          onChange={(v) => setViewMode(v as ViewMode)}
          data={[
            {
              label: (
                <Group gap={6}>
                  <IconCalendar size={16} />
                  Календарь
                </Group>
              ),
              value: 'calendar',
            },
            {
              label: (
                <Group gap={6}>
                  <IconList size={16} />
                  Список
                </Group>
              ),
              value: 'list',
            },
          ]}
          size="sm"
        />
      </Group>

      {viewMode === 'calendar' && (
        <CalendarView workspaceId={workspaceId} onAddClick={handleAddClick} />
      )}

      {viewMode === 'list' && <ListView workspaceId={workspaceId} />}

      <AddToPlanModal
        opened={modalOpened}
        onClose={closeModal}
        workspaceId={workspaceId}
        initialDate={selectedDate}
      />
    </Stack>
  )
}
