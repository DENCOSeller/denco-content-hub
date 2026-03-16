import { z } from 'zod'

export const addToPlanSchema = z.object({
  library_item_id: z.number({ error: 'Выберите контент' }).min(1, 'Выберите контент'),
  scheduled_at: z.date({ error: 'Выберите дату и время' }),
  assignee_id: z.number().nullable().optional(),
  notes: z.string().optional(),
})

export type AddToPlanFormValues = z.infer<typeof addToPlanSchema>

export const metricsSchema = z.object({
  views: z.number().int().min(0, 'Минимум 0').nullable(),
  reach: z.number().int().min(0, 'Минимум 0').nullable(),
  likes: z.number().int().min(0, 'Минимум 0').nullable(),
  comments: z.number().int().min(0, 'Минимум 0').nullable(),
})

export type MetricsFormValues = z.infer<typeof metricsSchema>
