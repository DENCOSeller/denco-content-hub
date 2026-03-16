'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useWorkspaceStore } from '@/stores/workspace-store'
import { useWorkspacesQuery } from '@/api/hooks/useWorkspaces'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { EmptyState } from '@/components/shared/EmptyState'

export default function SettingsRedirectPage() {
  const router = useRouter()
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace)
  const { data: workspaces, isLoading, isError, refetch } = useWorkspacesQuery()

  useEffect(() => {
    if (activeWorkspace) {
      router.replace(`/workspaces/${activeWorkspace.id}/settings`)
      return
    }

    if (workspaces && workspaces.length > 0) {
      const ws = workspaces[0]
      setActiveWorkspace({ id: ws.id, name: ws.name, slug: ws.slug, company_name: ws.company_name })
      router.replace(`/workspaces/${ws.id}/settings`)
    }
  }, [activeWorkspace, workspaces, router, setActiveWorkspace])

  if (isLoading) return <LoadingState message="Загрузка воркспейсов..." />
  if (isError) return <ErrorState message="Не удалось загрузить воркспейсы" onRetry={refetch} />
  if (workspaces && workspaces.length === 0) return <EmptyState message="Нет доступных воркспейсов" />

  return <LoadingState message="Перенаправление..." />
}
