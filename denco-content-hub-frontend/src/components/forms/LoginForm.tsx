'use client'

import { Button, TextInput, PasswordInput, Stack } from '@mantine/core'
import { useForm } from '@mantine/form'
import { zod4Resolver } from 'mantine-form-zod-resolver'
import { notifications } from '@mantine/notifications'
import { useRouter, useSearchParams } from 'next/navigation'

import { useLoginMutation } from '@/api/hooks/useAuth'
import { loginSchema, type LoginFormValues } from '@/lib/validations/auth'
import type { ErrorResponse } from '@/api/client/types.gen'
import styles from './forms.module.css'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/dashboard'
  const login = useLoginMutation()

  const form = useForm<LoginFormValues>({
    mode: 'uncontrolled',
    initialValues: { email: '', password: '' },
    validate: zod4Resolver(loginSchema),
  })

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await login.mutateAsync(values)
      router.push(redirectTo)
    } catch (error) {
      const detail = (error as ErrorResponse)?.detail
      notifications.show({
        title: 'Ошибка входа',
        message: detail || 'Неверный email или пароль',
        color: 'red',
      })
    }
  })

  return (
    <form onSubmit={handleSubmit}>
      <Stack>
        <TextInput
          label="Email"
          placeholder="your@email.com"
          key={form.key('email')}
          {...form.getInputProps('email')}
        />
        <PasswordInput
          label="Пароль"
          placeholder="Пароль"
          key={form.key('password')}
          {...form.getInputProps('password')}
        />
        <Button
          type="submit"
          loading={login.isPending}
          fullWidth
          className={styles.glowButton}
        >
          Войти
        </Button>
      </Stack>
    </form>
  )
}
