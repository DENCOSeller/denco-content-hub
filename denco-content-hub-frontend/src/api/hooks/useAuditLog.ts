'use client'

import { useQuery } from '@tanstack/react-query'
import { client } from '@/api/client/client.gen'

// --- Types ---

export interface AuditLogItem {
  id: number
  actor_id: number | null
  actor_email: string
  action: string
  resource_type: string
  resource_id: number | null
  organization_id: number | null
  details: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

export interface AuditLogListResponse {
  items: AuditLogItem[]
  total: number
}

export interface AuditLogParams {
  skip?: number
  limit?: number
  action?: string
  resource_type?: string
  actor_id?: number
  date_from?: string
  date_to?: string
}

// --- Helpers ---

function buildQueryParams(params: Record<string, string | number | undefined>): string {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      searchParams.append(key, String(value))
    }
  }
  const qs = searchParams.toString()
  return qs ? `?${qs}` : ''
}

export class ForbiddenError extends Error {
  status = 403
  constructor(message = 'Доступ запрещён') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

// --- Platform Audit Log (all orgs) ---

export function usePlatformAuditLogQuery(params: AuditLogParams) {
  return useQuery({
    queryKey: ['audit-log', 'platform', params],
    queryFn: async () => {
      const qs = buildQueryParams({
        skip: params.skip,
        limit: params.limit,
        action: params.action,
        resource_type: params.resource_type,
        actor_id: params.actor_id,
        date_from: params.date_from,
        date_to: params.date_to,
      })
      const response = await client.get({
        url: `/api/v1/platform/audit${qs}`,
      })
      if (response.response?.status === 403) {
        throw new ForbiddenError()
      }
      return response.data as AuditLogListResponse
    },
  })
}

// --- Organization Audit Log ---

export function useOrgAuditLogQuery(orgId: number, params: AuditLogParams) {
  return useQuery({
    queryKey: ['audit-log', 'org', orgId, params],
    queryFn: async () => {
      const qs = buildQueryParams({
        skip: params.skip,
        limit: params.limit,
        action: params.action,
        resource_type: params.resource_type,
        actor_id: params.actor_id,
        date_from: params.date_from,
        date_to: params.date_to,
      })
      const response = await client.get({
        url: `/api/v1/platform/audit/organizations/${orgId}${qs}`,
      })
      if (response.response?.status === 403) {
        throw new ForbiddenError()
      }
      return response.data as AuditLogListResponse
    },
    enabled: orgId > 0,
  })
}

// --- Action labels ---

export const ACTION_LABELS: Record<string, string> = {
  'auth.login': 'Вход в систему',
  'auth.logout': 'Выход из системы',
  'auth.impersonate': 'Имперсонация',
  'auth.stop_impersonate': 'Завершение имперсонации',
  'org.create': 'Создание организации',
  'org.update': 'Обновление организации',
  'org.delete': 'Удаление организации',
  'org.member.add': 'Добавление участника',
  'org.member.remove': 'Удаление участника',
  'org.member.role_change': 'Изменение роли участника',
  'workspace.create': 'Создание воркспейса',
  'workspace.update': 'Обновление воркспейса',
  'workspace.delete': 'Удаление воркспейса',
  'role.create': 'Создание роли',
  'role.update': 'Обновление роли',
  'role.delete': 'Удаление роли',
  'team.create': 'Создание команды',
  'team.update': 'Обновление команды',
  'team.delete': 'Удаление команды',
  'team.member.add': 'Добавление в команду',
  'team.member.remove': 'Удаление из команды',
}

export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  organization: 'Организация',
  workspace: 'Воркспейс',
  user: 'Пользователь',
  role: 'Роль',
  team: 'Команда',
  staff: 'Сотрудник',
  content: 'Контент',
  session: 'Сессия',
}

export function getActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action
}

export function getResourceTypeLabel(resourceType: string): string {
  return RESOURCE_TYPE_LABELS[resourceType] ?? resourceType
}
