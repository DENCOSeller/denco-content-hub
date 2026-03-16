'use client'

import { Anchor, Stack, Text, Title } from '@mantine/core'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

import { LoginForm } from '@/components/forms/LoginForm'
import styles from '../auth.module.css'

export default function LoginPage() {
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect')
  const registerHref = redirect
    ? `/register?redirect=${encodeURIComponent(redirect)}`
    : '/register'

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
                Вход
              </Title>
              <Text c="dimmed" size="sm">
                Нет аккаунта?{' '}
                <Anchor component={Link} href={registerHref} size="sm">
                  Зарегистрироваться
                </Anchor>
              </Text>
            </Stack>

            <LoginForm />
          </Stack>
        </div>
      </div>
    </div>
  )
}
