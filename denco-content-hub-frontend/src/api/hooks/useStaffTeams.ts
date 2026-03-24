'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { staffFetch } from '@/lib/staff-api'

// --- Types ---

export interface StaffTeamMember {
  id: number
  staff_id: number
  full_name: string
  email: string
  team_role: string
  joined_at: string
}

export interface StaffTeam {
  id: number
  organization_id: number
  name: string
  slug: string
  description: string | null
  member_count: number
  is_active: boolean
  created_at: string
  updated_at: string
  members?: StaffTeamMember[]
}

export interface StaffTeamDetail extends StaffTeam {
  members: StaffTeamMember[]
  workspace_accesses: StaffTeamWorkspaceAccess[]
}

export interface StaffTeamWorkspaceAccess {
  id: number
  team_id: number
  workspace_id: number
  workspace_name?: string
  default_role: string
  created_at: string
}

interface PaginatedStaffTeams {
  items: StaffTeam[]
  total: number
  page: number
  size: number
  pages: number
}

interface CreateTeamPayload {
  name: string
  description?: string
}

interface UpdateTeamPayload {
  name?: string
  description?: string
}

interface AddMemberPayload {
  staff_id: number
  team_role?: string
}

interface UpdateMemberPayload {
  team_role: string
}

interface AssignWorkspacePayload {
  workspace_id: number
  default_role?: string
}

// --- Query Hooks ---

export function useStaffTeamsQuery(orgId: number) {
  return useQuery({
    queryKey: ['staff-teams', orgId],
    queryFn: () =>
      staffFetch<PaginatedStaffTeams>(
        `/api/v1/organizations/${orgId}/teams?size=100`,
      ),
    enabled: orgId > 0,
  })
}

export function useStaffTeamDetailQuery(orgId: number, teamId: number) {
  return useQuery({
    queryKey: ['staff-teams', orgId, teamId],
    queryFn: () =>
      staffFetch<StaffTeamDetail>(
        `/api/v1/organizations/${orgId}/teams/${teamId}`,
      ),
    enabled: orgId > 0 && teamId > 0,
  })
}

// --- Mutation Hooks ---

export function useCreateStaffTeamMutation(orgId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateTeamPayload) =>
      staffFetch<StaffTeam>(`/api/v1/organizations/${orgId}/teams`, {
        method: 'POST',
        body: data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-teams', orgId] })
    },
  })
}

export function useUpdateStaffTeamMutation(orgId: number, teamId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateTeamPayload) =>
      staffFetch<StaffTeam>(`/api/v1/organizations/${orgId}/teams/${teamId}`, {
        method: 'PUT',
        body: data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-teams', orgId] })
      qc.invalidateQueries({ queryKey: ['staff-teams', orgId, teamId] })
    },
  })
}

export function useDeleteStaffTeamMutation(orgId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (teamId: number) =>
      staffFetch<void>(`/api/v1/organizations/${orgId}/teams/${teamId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-teams', orgId] })
    },
  })
}

// --- Members ---

export function useAddTeamMemberMutation(orgId: number, teamId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: AddMemberPayload) =>
      staffFetch<StaffTeamMember>(
        `/api/v1/organizations/${orgId}/teams/${teamId}/members`,
        { method: 'POST', body: data },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-teams', orgId, teamId] })
      qc.invalidateQueries({ queryKey: ['staff-teams', orgId] })
    },
  })
}

export function useUpdateTeamMemberMutation(orgId: number, teamId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ memberId, data }: { memberId: number; data: UpdateMemberPayload }) =>
      staffFetch<StaffTeamMember>(
        `/api/v1/organizations/${orgId}/teams/${teamId}/members/${memberId}`,
        { method: 'PUT', body: data },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-teams', orgId, teamId] })
    },
  })
}

export function useRemoveTeamMemberMutation(orgId: number, teamId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (memberId: number) =>
      staffFetch<void>(
        `/api/v1/organizations/${orgId}/teams/${teamId}/members/${memberId}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-teams', orgId, teamId] })
      qc.invalidateQueries({ queryKey: ['staff-teams', orgId] })
    },
  })
}

// --- Workspace Access ---

export function useAssignTeamWorkspaceMutation(orgId: number, teamId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: AssignWorkspacePayload) =>
      staffFetch<StaffTeamWorkspaceAccess>(
        `/api/v1/organizations/${orgId}/teams/${teamId}/workspaces`,
        { method: 'POST', body: data },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-teams', orgId, teamId] })
    },
  })
}

export function useRemoveTeamWorkspaceMutation(orgId: number, teamId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (accessId: number) =>
      staffFetch<void>(
        `/api/v1/organizations/${orgId}/teams/${teamId}/workspaces/${accessId}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-teams', orgId, teamId] })
    },
  })
}
