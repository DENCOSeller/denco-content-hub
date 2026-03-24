import { z } from 'zod'
import type { WorkspaceRole } from '@/api/client/types.gen'

export const roleLabelMap: Record<WorkspaceRole, string> = {
  owner: 'Владелец',
  admin: 'Админ',
  editor: 'Редактор',
  viewer: 'Просмотр',
  contractor: 'Подрядчик',
}

export const roleColorMap: Record<WorkspaceRole, string> = {
  owner: 'contentHubTeal',
  admin: 'violet',
  editor: 'green',
  viewer: 'gray',
  contractor: 'orange',
}

export const inviteSchema = z.object({
  email: z.string().email('Некорректный email'),
  role: z.enum(['admin', 'editor', 'viewer'], { message: 'Выберите роль' }),
})

export type InviteFormValues = z.infer<typeof inviteSchema>
