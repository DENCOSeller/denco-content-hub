'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { client } from '@/api/client/client.gen'

// --- Types ---

export interface TeamResponse {
  id: number
  staff_team_id: number
  organization_id: number
  name: string
  slug: string
  member_count: number
  synced_at: string
  created_at: string
}

export interface TeamWorkspaceAccessResponse {
  id: number
  team_id: number
  workspace_id: number
  workspace_name: string
  workspace_slug: string
  default_role: string
  created_at: string
}

interface PaginatedTeams {
  items: TeamResponse[]
  total: number
  page: number
  size: number
  pages: number
}

// --- Hooks ---

export function useTeamsQuery(organizationId: number) {
  return useQuery({
    queryKey: ['teams', organizationId],
    queryFn: async () => {
      const result = await client.get({
        url: '/api/v1/organizations/{organization_id}/teams',
        path: { organization_id: organizationId },
        query: { size: 100 },
      })
      if (result.error) {
        throw new Error((result.error as { detail?: string }).detail ?? 'Failed to load teams')
      }
      return result.data as PaginatedTeams
    },
    enabled: organizationId > 0,
  })
}

export function useTeamWorkspaceAccessQuery(organizationId: number, teamId: number) {
  return useQuery({
    queryKey: ['teams', organizationId, teamId, 'workspace-access'],
    queryFn: async () => {
      const result = await client.get({
        url: '/api/v1/organizations/{organization_id}/teams/{team_id}/workspace-access',
        path: { organization_id: organizationId, team_id: teamId },
      })
      if (result.error) {
        throw new Error((result.error as { detail?: string }).detail ?? 'Failed to load workspace access')
      }
      return result.data as TeamWorkspaceAccessResponse[]
    },
    enabled: organizationId > 0 && teamId > 0,
  })
}

export function useAddTeamWorkspaceAccessMutation(organizationId: number, teamId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { workspace_id: number; default_role: string }) => {
      const result = await client.post({
        url: '/api/v1/organizations/{organization_id}/teams/{team_id}/workspace-access',
        path: { organization_id: organizationId, team_id: teamId },
        body: data,
      })
      if (result.error) {
        throw new Error((result.error as { detail?: string }).detail ?? 'Failed to add workspace access')
      }
      return result.data as TeamWorkspaceAccessResponse
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams', organizationId, teamId, 'workspace-access'] })
    },
  })
}

export function useRemoveTeamWorkspaceAccessMutation(organizationId: number, teamId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (workspaceId: number) => {
      const result = await client.delete({
        url: '/api/v1/organizations/{organization_id}/teams/{team_id}/workspace-access/{workspace_id}',
        path: { organization_id: organizationId, team_id: teamId, workspace_id: workspaceId },
      })
      if (result.error) {
        throw new Error((result.error as { detail?: string }).detail ?? 'Failed to remove workspace access')
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams', organizationId, teamId, 'workspace-access'] })
    },
  })
}
