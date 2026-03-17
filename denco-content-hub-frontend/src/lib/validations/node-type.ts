import { z } from 'zod'

export const nodeTypeDefCreateSchema = z.object({
  label: z
    .string()
    .min(1, 'Название обязательно')
    .max(100, 'Максимум 100 символов'),
  slug: z
    .string()
    .min(1, 'Slug обязателен')
    .max(50, 'Максимум 50 символов')
    .regex(/^[a-z][a-z0-9_]*$/, 'Только латиница, цифры и _ (начинается с буквы)'),
  icon: z.string().default('IconNote'),
  color: z.string().default('#8E8E93'),
})

export type NodeTypeDefCreateForm = z.infer<typeof nodeTypeDefCreateSchema>
