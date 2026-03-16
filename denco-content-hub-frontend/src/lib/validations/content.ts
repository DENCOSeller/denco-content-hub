import { z } from 'zod'

const YOUTUBE_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
]

export const addContentSchema = z.object({
  url: z
    .string()
    .url('Введите корректный URL')
    .refine(
      (val) => {
        try {
          const url = new URL(val)
          return YOUTUBE_HOSTS.includes(url.hostname)
        } catch {
          return false
        }
      },
      { message: 'Поддерживаются только YouTube-ссылки' },
    ),
})

export type AddContentFormValues = z.infer<typeof addContentSchema>

export const youtubeSourceSchema = z.object({
  url: z
    .string()
    .min(1, 'Введите URL')
    .url('Введите корректный URL')
    .refine(
      (val) => {
        try {
          const url = new URL(val)
          return YOUTUBE_HOSTS.includes(url.hostname)
        } catch {
          return false
        }
      },
      { message: 'Поддерживаются только YouTube-ссылки' },
    ),
})

export const webPageSourceSchema = z.object({
  url: z
    .string()
    .min(1, 'Введите URL')
    .url('Введите корректный URL')
    .refine(
      (val) => {
        try {
          const url = new URL(val)
          return url.protocol === 'http:' || url.protocol === 'https:'
        } catch {
          return false
        }
      },
      { message: 'Поддерживаются только HTTP/HTTPS ссылки' },
    ),
})

export const manualTextSourceSchema = z.object({
  title: z.string().min(1, 'Введите заголовок'),
  text: z.string().min(1, 'Введите текст'),
})

export type YoutubeSourceValues = z.infer<typeof youtubeSourceSchema>
export type WebPageSourceValues = z.infer<typeof webPageSourceSchema>
export type ManualTextSourceValues = z.infer<typeof manualTextSourceSchema>
