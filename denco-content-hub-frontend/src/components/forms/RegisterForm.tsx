'use client'

import { Button, TextInput, PasswordInput, Stack } from '@mantine/core'
import { useForm } from '@mantine/form'
import { zod4Resolver } from 'mantine-form-zod-resolver'
import { notifications } from '@mantine/notifications'
import { useRouter, useSearchParams } from 'next/navigation'

import { useRegisterMutation } from '@/api/hooks/useAuth'
import { registerSchema, type RegisterFormValues } from '@/lib/validations/auth'
import type { ErrorResponse } from '@/api/client/types.gen'
import styles from './forms.module.css'

export function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/dashboard'
  const register = useRegisterMutation()

  const form = useForm<RegisterFormValues>({
    mode: 'uncontrolled',
    initialValues: { name: '', email: '', password: '', confirmPassword: '' },
    validate: zod4Resolver(registerSchema),
  })

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await register.mutateAsync({
        name: values.name,
        email: values.email,
        password: values.password,
      })
      router.push(redirectTo)
    } catch (error) {
      const detail = (error as ErrorResponse)?.detail
      notifications.show({
        title: 'Ошибка регистрации',
        message: detail || 'Не удалось зарегистрироваться',
        color: 'red',
      })
    }
  })

  return (
    <form onSubmit={handleSubmit}>
      <Stack>
        <TextInput
          label="Имя"
          placeholder="Ваше имя"
          key={form.key('name')}
          {...form.getInputProps('name')}
        />
        <TextInput
          label="Email"
          placeholder="your@email.com"
          key={form.key('email')}
          {...form.getInputProps('email')}
        />
        <PasswordInput
          label="Пароль"
          placeholder="Минимум 6 символов"
          key={form.key('password')}
          {...form.getInputProps('password')}
        />
        <PasswordInput
          label="Подтвердите пароль"
          placeholder="Повторите пароль"
          key={form.key('confirmPassword')}
          {...form.getInputProps('confirmPassword')}
        />
        <Button
          type="submit"
          loading={register.isPending}
          fullWidth
          className={styles.glowButton}
        >
          Зарегистрироваться
        </Button>
      </Stack>
    </form>
  )
}
