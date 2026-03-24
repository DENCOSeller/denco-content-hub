'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { staffFetch } from '@/lib/staff-api'

// --- Types ---

export interface CustomRole {
  id: number
  organization_id: number
  name: string
  slug: string
  description: string | null
  base_role: string
  permissions: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface RolePermissions {
  role: string
  permissions: string[]
}

interface CreateCustomRolePayload {
  name: string
  slug: string
  description?: string
  base_role: string
  permissions: string[]
}

interface UpdateCustomRolePayload {
  name?: string
  description?: string
  base_role?: string
  permissions?: string[]
}

// --- Query Hooks ---

export function useCustomRolesQuery(orgId: number) {
  return useQuery({
    queryKey: ['custom-roles', orgId],
    queryFn: () =>
      staffFetch<CustomRole[]>(
        `/api/v1/organizations/${orgId}/custom-roles`,
      ),
    enabled: orgId > 0,
  })
}

export function useCustomRoleDetailQuery(orgId: number, roleId: number) {
  return useQuery({
    queryKey: ['custom-roles', orgId, roleId],
    queryFn: () =>
      staffFetch<CustomRole>(
        `/api/v1/organizations/${orgId}/custom-roles/${roleId}`,
      ),
    enabled: orgId > 0 && roleId > 0,
  })
}

export function useRolePermissionsQuery(orgId: number, role: string) {
  return useQuery({
    queryKey: ['role-permissions', orgId, role],
    queryFn: () =>
      staffFetch<RolePermissions>(
        `/api/v1/organizations/${orgId}/custom-roles/permissions/by-role/${role}`,
      ),
    enabled: orgId > 0 && !!role,
  })
}

// --- Mutation Hooks ---

export function useCreateCustomRoleMutation(orgId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateCustomRolePayload) =>
      staffFetch<CustomRole>(`/api/v1/organizations/${orgId}/custom-roles`, {
        method: 'POST',
        body: data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-roles', orgId] })
    },
  })
}

export function useUpdateCustomRoleMutation(orgId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ roleId, data }: { roleId: number; data: UpdateCustomRolePayload }) =>
      staffFetch<CustomRole>(`/api/v1/organizations/${orgId}/custom-roles/${roleId}`, {
        method: 'PUT',
        body: data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-roles', orgId] })
    },
  })
}

export function useDeleteCustomRoleMutation(orgId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (roleId: number) =>
      staffFetch<void>(`/api/v1/organizations/${orgId}/custom-roles/${roleId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-roles', orgId] })
    },
  })
}

// --- Permission Categories (hardcoded for UI) ---

export const PERMISSION_CATEGORIES = [
  {
    label: 'Контент',
    permissions: [
      { key: 'content:read', label: 'Просмотр контента' },
      { key: 'content:create', label: 'Создание контента' },
      { key: 'content:edit', label: 'Редактирование контента' },
      { key: 'content:delete', label: 'Удаление контента' },
      { key: 'content:publish', label: 'Публикация контента' },
    ],
  },
  {
    label: 'Воркспейсы',
    permissions: [
      { key: 'workspace:read', label: 'Просмотр воркспейсов' },
      { key: 'workspace:create', label: 'Создание воркспейсов' },
      { key: 'workspace:edit', label: 'Редактирование воркспейсов' },
      { key: 'workspace:delete', label: 'Удаление воркспейсов' },
      { key: 'workspace:manage_members', label: 'Управление участниками' },
    ],
  },
  {
    label: 'Команды',
    permissions: [
      { key: 'team:read', label: 'Просмотр команд' },
      { key: 'team:create', label: 'Создание команд' },
      { key: 'team:edit', label: 'Редактирование команд' },
      { key: 'team:delete', label: 'Удаление команд' },
      { key: 'team:manage_members', label: 'Управление участниками команд' },
    ],
  },
  {
    label: 'Организация',
    permissions: [
      { key: 'org:read', label: 'Просмотр организации' },
      { key: 'org:edit', label: 'Редактирование организации' },
      { key: 'org:manage_roles', label: 'Управление ролями' },
      { key: 'org:manage_billing', label: 'Управление биллингом' },
      { key: 'org:invite_members', label: 'Приглашение участников' },
    ],
  },
  {
    label: 'Аналитика',
    permissions: [
      { key: 'analytics:read', label: 'Просмотр аналитики' },
      { key: 'analytics:export', label: 'Экспорт данных' },
    ],
  },
] as const

export const ALL_PERMISSIONS = PERMISSION_CATEGORIES.flatMap((c) =>
  c.permissions.map((p) => p.key),
)
