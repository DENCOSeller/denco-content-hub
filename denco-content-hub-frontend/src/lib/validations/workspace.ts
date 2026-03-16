import { z } from 'zod'

export const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'Название обязательно').max(255, 'Максимум 255 символов'),
})

export type CreateWorkspaceFormValues = z.infer<typeof createWorkspaceSchema>
