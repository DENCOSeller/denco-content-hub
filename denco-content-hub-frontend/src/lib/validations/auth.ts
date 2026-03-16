import { z } from 'zod'

export const loginSchema = z.object({
  email: z.email('Некорректный email'),
  password: z.string().min(6, 'Минимум 6 символов'),
})

export type LoginFormValues = z.infer<typeof loginSchema>

export const registerSchema = z.object({
  name: z.string().min(2, 'Минимум 2 символа'),
  email: z.email('Некорректный email'),
  password: z.string().min(6, 'Минимум 6 символов'),
  confirmPassword: z.string().min(6, 'Минимум 6 символов'),
}).check(
  (ctx) => {
    if (ctx.value.password !== ctx.value.confirmPassword) {
      ctx.issues.push({
        code: 'custom',
        input: ctx.value.confirmPassword,
        message: 'Пароли не совпадают',
        path: ['confirmPassword'],
      })
    }
  },
)

export type RegisterFormValues = z.infer<typeof registerSchema>
