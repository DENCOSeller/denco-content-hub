'use client'

import { Stack, Group, SegmentedControl, Skeleton, Box, Button } from '@mantine/core'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { IconCalendar, IconList, IconCheckbox } from '@tabler/icons-react'
import { useState, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'

import { AppBreadcrumbs } from '@/components/shared/Breadcrumbs'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { CalendarView } from '@/components/features/content-plan/CalendarView'
import { ListView } from '@/components/features/content-plan/ListView'
import { AddToPlanModal } from '@/components/features/content-plan/AddToPlanModal'
import { PlanStatsBar } from '@/components/features/content-plan/PlanStatsBar'
import { BulkActionBar } from '@/components/features/content-plan/BulkActionBar'
import { useContentPlanItemsQuery } from '@/api/hooks/useContentPlan'

import styles from './content-plan.module.css'

type ViewMode = 'calendar' | 'list'

function CalendarSkeleton() {
  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Skeleton height={28} width={200} radius="sm" />
        <Skeleton height={28} width={80} radius="xl" />
      </Group>
      <Group gap={0}>
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} height={16} width="14%" radius="sm" mx={1} />
        ))}
      </Group>
      <Skeleton height={480} radius="xl" />
    </Stack>
  )
}

export default function ContentPlanPage() {
  const params = useParams()
  const workspaceId = Number(params.id)
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)
  const [viewMode, setViewMode] = useState<ViewMode>('calendar')
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const isMobile = useMediaQuery('(max-width: 768px)')

  // Query items for stats bar
  const { data: planData } = useContentPlanItemsQuery(workspaceId, { size: 100 })
  const allItems = useMemo(() => planData?.items ?? [], [planData?.items])

  const handleAddClick = useCallback((date: Date) => {
    setSelectedDate(date)
    openModal()
  }, [openModal])

  const handleToggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const handleToggleBulkMode = useCallback(() => {
    setBulkMode((prev) => {
      if (prev) {
        // Exiting bulk mode — clear selection
        setSelectedIds(new Set())
      }
      return !prev
    })
  }, [])

  const breadcrumbs = [
    { label: activeWorkspace?.company_name ?? '' },
    { label: activeWorkspace?.name ?? '', href: `/workspaces/${workspaceId}` },
    { label: 'Контент-план' },
  ]

  // On mobile, always show list
  const effectiveView = isMobile ? 'list' : viewMode

  // isMobile is undefined on SSR, treat as "loading"
  const isHydrated = isMobile !== undefined

  return (
    <Stack gap="lg">
      <AppBreadcrumbs items={breadcrumbs} />

      <Group justify="space-between" align="center">
        <h2 className={styles.pageTitle}>Контент-план</h2>

        <Group gap="xs">
          <Button
            variant={bulkMode ? 'light' : 'subtle'}
            color={bulkMode ? 'teal' : 'gray'}
            size="xs"
            leftSection={<IconCheckbox size={16} stroke={1.5} />}
            onClick={handleToggleBulkMode}
            className={styles.bulkToggle}
          >
            Выделение
          </Button>

          {/* Hide SegmentedControl on mobile */}
          {!isMobile && (
            <SegmentedControl
              value={viewMode}
              onChange={(v) => setViewMode(v as ViewMode)}
              data={[
                {
                  label: (
                    <Group gap={6}>
                      <IconCalendar size={16} stroke={1.5} />
                      Календарь
                    </Group>
                  ),
                  value: 'calendar',
                },
                {
                  label: (
                    <Group gap={6}>
                      <IconList size={16} stroke={1.5} />
                      Список
                    </Group>
                  ),
                  value: 'list',
                },
              ]}
              size="sm"
              withItemsBorders={false}
              classNames={{
                root: styles.viewSwitchRoot,
                indicator: styles.viewSwitchIndicator,
                label: styles.viewSwitchLabel,
                control: styles.viewSwitchControl,
              }}
              transitionDuration={250}
              transitionTimingFunction="ease"
            />
          )}
        </Group>
      </Group>

      {allItems.length > 0 && <PlanStatsBar items={allItems} />}

      {!isHydrated ? (
        <CalendarSkeleton />
      ) : (
        <Box>
          {effectiveView === 'calendar' && (
            <CalendarView
              workspaceId={workspaceId}
              onAddClick={handleAddClick}
              selectable={bulkMode}
              selectedIds={selectedIds}
              onSelect={handleToggleSelect}
            />
          )}

          {effectiveView === 'list' && (
            <ListView
              workspaceId={workspaceId}
              selectable={bulkMode}
              selectedIds={selectedIds}
              onSelect={handleToggleSelect}
            />
          )}
        </Box>
      )}

      {bulkMode && (
        <BulkActionBar
          selectedIds={selectedIds}
          workspaceId={workspaceId}
          onClearSelection={handleClearSelection}
        />
      )}

      <AddToPlanModal
        opened={modalOpened}
        onClose={closeModal}
        workspaceId={workspaceId}
        initialDate={selectedDate}
      />
    </Stack>
  )
}
