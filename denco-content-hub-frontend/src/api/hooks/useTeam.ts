'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listMembersApiV1WorkspacesWorkspaceIdMembersGet,
  removeMemberApiV1WorkspacesWorkspaceIdMembersMemberIdDelete,
  listInvitationsApiV1WorkspacesWorkspaceIdInvitationsGet,
  createInvitationApiV1WorkspacesWorkspaceIdInvitationsPost,
  cancelInvitationApiV1WorkspacesWorkspaceIdInvitationsInvitationIdDelete,
  getInvitationInfoApiV1InvitationsTokenGet,
  acceptInvitationApiV1InvitationsTokenAcceptPost,
} from '@/api/client'
import type { CreateInvitationRequest } from '@/api/client/types.gen'

export function useMembersQuery(workspaceId: number) {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'members'],
    queryFn: async () => {
      const result = await listMembersApiV1WorkspacesWorkspaceIdMembersGet({
        path: { workspace_id: workspaceId },
        query: { size: 100 },
        throwOnError: true,
      })
      return result.data
    },
    enabled: workspaceId > 0,
  })
}

export function useRemoveMemberMutation(workspaceId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (memberId: number) =>
      removeMemberApiV1WorkspacesWorkspaceIdMembersMemberIdDelete({
        path: { workspace_id: workspaceId, member_id: memberId },
        throwOnError: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'members'] })
    },
  })
}

export function useInvitationsQuery(workspaceId: number) {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'invitations'],
    queryFn: async () => {
      const result = await listInvitationsApiV1WorkspacesWorkspaceIdInvitationsGet({
        path: { workspace_id: workspaceId },
        query: { size: 100 },
        throwOnError: true,
      })
      return result.data
    },
    enabled: workspaceId > 0,
  })
}

export function useCreateInvitationMutation(workspaceId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateInvitationRequest) => {
      const result = await createInvitationApiV1WorkspacesWorkspaceIdInvitationsPost({
        path: { workspace_id: workspaceId },
        body: data,
        throwOnError: true,
      })
      return result.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'invitations'] })
    },
  })
}

export function useCancelInvitationMutation(workspaceId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (invitationId: number) =>
      cancelInvitationApiV1WorkspacesWorkspaceIdInvitationsInvitationIdDelete({
        path: { workspace_id: workspaceId, invitation_id: invitationId },
        throwOnError: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'invitations'] })
    },
  })
}

export function useInvitationInfoQuery(token: string) {
  return useQuery({
    queryKey: ['invitations', token],
    queryFn: async () => {
      const result = await getInvitationInfoApiV1InvitationsTokenGet({
        path: { token },
        throwOnError: true,
      })
      return result.data
    },
    enabled: !!token,
    retry: false,
  })
}

export function useAcceptInvitationMutation() {
  return useMutation({
    mutationFn: (token: string) =>
      acceptInvitationApiV1InvitationsTokenAcceptPost({
        path: { token },
        throwOnError: true,
      }),
  })
}
