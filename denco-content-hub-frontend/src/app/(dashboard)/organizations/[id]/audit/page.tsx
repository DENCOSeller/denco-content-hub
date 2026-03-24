'use client'

import { useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Stack } from '@mantine/core'
import { IconShieldOff } from '@tabler/icons-react'

import { PageHeader } from '@denco/ui'
import { useOrganizationStore } from '@/stores/organization-store'
import { AppBreadcrumbs } from '@/components/shared/Breadcrumbs'
import { AuditLogTable } from '@/components/features/audit/AuditLogTable'
import { useOrgAuditLogQuery, ForbiddenError } from '@/api/hooks/useAuditLog'
import type { AuditLogParams } from '@/api/hooks/useAuditLog'

import styles from '@/components/features/audit/AuditLogTable.module.css'

export default function OrgAuditPage() {
  const params = useParams()
  const orgId = Number(params.id)
  const activeOrganization = useOrganizationStore((s) => s.activeOrganization)

  const [queryParams, setQueryParams] = useState<AuditLogParams>({
    skip: 0,
    limit: 25,
  })

  const { data, isLoading, isError, error, refetch } = useOrgAuditLogQuery(orgId, queryParams)

  const handleParamsChange = useCallback((updates: Partial<AuditLogParams>) => {
    setQueryParams((prev) => ({ ...prev, ...updates }))
  }, [])

  const breadcrumbs = [
    { label: 'Организации', href: '/organizations' },
    { label: activeOrganization?.name ?? 'Организация', href: `/organizations/${orgId}` },
    { label: 'Журнал действий' },
  ]

  const isForbidden = isError && error instanceof ForbiddenError

  return (
    <Stack gap="lg">
      <AppBreadcrumbs items={breadcrumbs} />

      <PageHeader
        title="Журнал действий"
        subtitle={activeOrganization?.name ? `${activeOrganization.name} — история действий` : 'История действий организации'}
      />

      {isForbidden ? (
        <div className={styles.forbiddenCard}>
          <div className={styles.forbiddenIcon}>
            <IconShieldOff size={28} color="var(--color-error)" />
          </div>
          <div className={styles.forbiddenTitle}>Доступ запрещен</div>
          <div className={styles.forbiddenText}>
            У вас нет прав для просмотра журнала аудита этой организации
          </div>
        </div>
      ) : (
        <AuditLogTable
          data={data}
          isLoading={isLoading}
          isError={isError}
          refetch={refetch}
          params={queryParams}
          onParamsChange={handleParamsChange}
        />
      )}
    </Stack>
  )
}
