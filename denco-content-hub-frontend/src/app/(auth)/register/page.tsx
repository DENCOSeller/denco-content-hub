'use client'

import { Anchor, Stack, Text, Title } from '@mantine/core'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

import { RegisterForm } from '@/components/forms/RegisterForm'
import styles from '../auth.module.css'

export default function RegisterPage() {
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect')
  const loginHref = redirect
    ? `/login?redirect=${encodeURIComponent(redirect)}`
    : '/login'

  return (
    <div className={styles.wrapper}>
      <div className={styles.brandPanel}>
        <div className={styles.brandLogo}>DENCO Content Hub</div>
        <div className={styles.brandSlogan}>
          Управляйте контентом. Контролируйте результат.
        </div>
      </div>

      <div className={styles.formPanel}>
        <div className={styles.formCard}>
          <Stack gap="lg">
            <Stack align="center" gap={4}>
              <Title order={2} className={styles.formTitle}>
                Регистрация
              </Title>
              <Text c="dimmed" size="sm">
                Уже есть аккаунт?{' '}
                <Anchor component={Link} href={loginHref} size="sm">
                  Войти
                </Anchor>
              </Text>
            </Stack>

            <RegisterForm />
          </Stack>
        </div>
      </div>
    </div>
  )
}
