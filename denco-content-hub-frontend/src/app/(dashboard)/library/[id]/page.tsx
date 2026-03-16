'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { useWorkspaceStore } from '@/stores/workspace-store'
import { useWorkspacesQuery } from '@/api/hooks/useWorkspaces'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { EmptyState } from '@/components/shared/EmptyState'

export default function ContentDetailRedirectPage() {
  const params = useParams()
  const router = useRouter()
  const contentId = params.id as string
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace)
  const { data: workspaces, isLoading, isError, refetch } = useWorkspacesQuery()

  useEffect(() => {
    if (activeWorkspace) {
      router.replace(`/workspaces/${activeWorkspace.id}/references/${contentId}`)
      return
    }

    if (workspaces && workspaces.length > 0) {
      const ws = workspaces[0]
      setActiveWorkspace({ id: ws.id, name: ws.name, slug: ws.slug, company_name: ws.company_name })
      router.replace(`/workspaces/${ws.id}/references/${contentId}`)
    }
  }, [activeWorkspace, workspaces, contentId, router, setActiveWorkspace])

  if (isLoading) return <LoadingState message="Загрузка воркспейсов..." />
  if (isError) return <ErrorState message="Не удалось загрузить воркспейсы" onRetry={refetch} />
  if (workspaces && workspaces.length === 0) return <EmptyState message="Нет доступных воркспейсов" />

  return <LoadingState message="Перенаправление..." />
}
