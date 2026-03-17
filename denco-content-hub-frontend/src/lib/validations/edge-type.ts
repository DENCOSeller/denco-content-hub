import { z } from 'zod'

export const edgeTypeDefCreateSchema = z.object({
  label: z
    .string()
    .min(1, 'Название обязательно')
    .max(100, 'Максимум 100 символов'),
  slug: z
    .string()
    .min(1, 'Slug обязателен')
    .max(50, 'Максимум 50 символов')
    .regex(/^[a-z][a-z0-9_]*$/, 'Только латиница, цифры и _ (начинается с буквы)'),
  description: z.string().max(500).optional(),
  is_directed: z.boolean(),
})

export type EdgeTypeDefCreateForm = z.infer<typeof edgeTypeDefCreateSchema>
