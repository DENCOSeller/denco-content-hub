'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { useWorkspaceStore } from '@/stores/workspace-store'
import { useWorkspacesQuery } from '@/api/hooks/useWorkspaces'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { EmptyState } from '@/components/shared/EmptyState'

export default function LibraryRedirectPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace)
  const { data: workspaces, isLoading, isError, refetch } = useWorkspacesQuery()

  useEffect(() => {
    // 1. If activeWorkspace exists — redirect immediately
    if (activeWorkspace) {
      const search = searchParams.toString()
      const target = `/workspaces/${activeWorkspace.id}/references${search ? `?${search}` : ''}`
      router.replace(target)
      return
    }

    // 2. If workspaces loaded — pick first and redirect
    if (workspaces && workspaces.length > 0) {
      const ws = workspaces[0]
      setActiveWorkspace({ id: ws.id, name: ws.name, slug: ws.slug, company_name: ws.company_name })
      const search = searchParams.toString()
      const target = `/workspaces/${ws.id}/references${search ? `?${search}` : ''}`
      router.replace(target)
    }
  }, [activeWorkspace, workspaces, router, searchParams, setActiveWorkspace])

  if (isLoading) return <LoadingState message="Загрузка воркспейсов..." />
  if (isError) return <ErrorState message="Не удалось загрузить воркспейсы" onRetry={refetch} />
  if (workspaces && workspaces.length === 0) return <EmptyState message="Нет доступных воркспейсов" />

  return <LoadingState message="Перенаправление..." />
}
