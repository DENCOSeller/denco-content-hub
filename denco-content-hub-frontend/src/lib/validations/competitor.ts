import { z } from 'zod'

const urlPattern = /^https?:\/\/.+/

export const addCompetitorSchema = z.object({
  url: z
    .string()
    .min(1, 'URL обязателен')
    .regex(urlPattern, 'Введите корректный URL (https://...)')
    .max(500, 'Максимум 500 символов'),
})

export type AddCompetitorFormValues = z.infer<typeof addCompetitorSchema>
