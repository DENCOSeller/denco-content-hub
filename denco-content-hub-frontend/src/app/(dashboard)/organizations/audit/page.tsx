'use client'

import { useEffect, useState, useCallback } from 'react'
import { Stack } from '@mantine/core'
import { useRouter } from 'next/navigation'

import { PageHeader } from '@denco/ui'
import { useAuthStore } from '@/stores/auth-store'
import { AppBreadcrumbs } from '@/components/shared/Breadcrumbs'
import { LoadingState } from '@/components/shared/LoadingState'
import { AuditLogTable } from '@/components/features/audit/AuditLogTable'
import { usePlatformAuditLogQuery } from '@/api/hooks/useAuditLog'
import type { AuditLogParams } from '@/api/hooks/useAuditLog'

export default function PlatformAuditPage() {
  const user = useAuthStore((s) => s.user)
  const router = useRouter()

  const [params, setParams] = useState<AuditLogParams>({
    skip: 0,
    limit: 25,
  })

  // Guard: redirect non-platform-owners
  useEffect(() => {
    if (user && !user.is_platform_owner) {
      router.replace('/dashboard')
    }
  }, [user, router])

  const { data, isLoading, isError, refetch } = usePlatformAuditLogQuery(params)

  const handleParamsChange = useCallback((updates: Partial<AuditLogParams>) => {
    setParams((prev) => ({ ...prev, ...updates }))
  }, [])

  const breadcrumbs = [
    { label: 'Организации', href: '/organizations' },
    { label: 'Журнал действий' },
  ]

  if (!user?.is_platform_owner) return <LoadingState />

  return (
    <Stack gap="lg">
      <AppBreadcrumbs items={breadcrumbs} />

      <PageHeader
        title="Журнал действий"
        subtitle="Все действия пользователей на платформе"
      />

      <AuditLogTable
        data={data}
        isLoading={isLoading}
        isError={isError}
        refetch={refetch}
        params={params}
        onParamsChange={handleParamsChange}
      />
    </Stack>
  )
}
