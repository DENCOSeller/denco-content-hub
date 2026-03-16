'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listWorkspacesApiV1WorkspacesGet,
  createWorkspaceApiV1WorkspacesPost,
  getWorkspaceApiV1WorkspacesWorkspaceIdGet,
  updateWorkspaceApiV1WorkspacesWorkspaceIdPatch,
  deleteWorkspaceApiV1WorkspacesWorkspaceIdDelete,
} from '@/api/client'
import type { WorkspaceCreate, WorkspaceUpdate } from '@/api/client/types.gen'

export function useWorkspacesQuery() {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const result = await listWorkspacesApiV1WorkspacesGet({
        throwOnError: true,
      })
      return result.data
    },
  })
}

export function useWorkspaceDetailQuery(workspaceId: number) {
  return useQuery({
    queryKey: ['workspaces', workspaceId],
    queryFn: async () => {
      const result = await getWorkspaceApiV1WorkspacesWorkspaceIdGet({
        path: { workspace_id: workspaceId },
        throwOnError: true,
      })
      return result.data
    },
    enabled: !!workspaceId,
  })
}

export function useCreateWorkspaceMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: WorkspaceCreate) => {
      const result = await createWorkspaceApiV1WorkspacesPost({
        body: data,
        throwOnError: true,
      })
      return result.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces'] })
    },
  })
}

export function useUpdateWorkspaceMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      workspaceId,
      data,
    }: {
      workspaceId: number
      data: WorkspaceUpdate
    }) => {
      const result = await updateWorkspaceApiV1WorkspacesWorkspaceIdPatch({
        path: { workspace_id: workspaceId },
        body: data,
        throwOnError: true,
      })
      return result.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces'] })
    },
  })
}

export function useDeleteWorkspaceMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (workspaceId: number) =>
      deleteWorkspaceApiV1WorkspacesWorkspaceIdDelete({
        path: { workspace_id: workspaceId },
        throwOnError: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces'] })
    },
  })
}
