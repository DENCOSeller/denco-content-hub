'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { notifications } from '@mantine/notifications'

import { useWorkspaceDetailQuery } from '@/api/hooks/useWorkspaces'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { LoadingState } from '@/components/shared/LoadingState'

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const router = useRouter()
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace)

  const workspaceId = Number(params.id)
  const isValidId = !Number.isNaN(workspaceId) && workspaceId > 0

  const { data: workspace, isLoading, isError, error } = useWorkspaceDetailQuery(
    isValidId ? workspaceId : 0,
  )

  useEffect(() => {
    if (!isValidId) {
      router.replace('/dashboard')
    }
  }, [isValidId, router])

  useEffect(() => {
    if (isError) {
      const status = (error as { status?: number })?.status
      const message =
        status === 403
          ? 'Нет доступа к воркспейсу'
          : 'Воркспейс не найден'

      notifications.show({
        title: 'Ошибка',
        message,
        color: 'red',
      })
      router.replace('/dashboard')
    }
  }, [isError, error, router])

  useEffect(() => {
    if (workspace) {
      setActiveWorkspace({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        company_name: workspace.company_name,
      })
    }
  }, [workspace, setActiveWorkspace])

  if (!isValidId || isLoading) {
    return <LoadingState />
  }

  if (isError || !workspace) {
    return null
  }

  return <>{children}</>
}
