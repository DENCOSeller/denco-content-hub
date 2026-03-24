import { Button, Center, Stack, Text, Title } from '@mantine/core'
import Link from 'next/link'

import styles from './not-found.module.css'

export default function NotFound() {
  return (
    <Center mih="100vh" bg="var(--app-bg)">
      <Stack align="center" gap="md">
        <Title order={1} fz={80} fw={800} className={styles.gradientTitle}>
          404
        </Title>
        <Text c="dimmed" size="lg">
          Страница не найдена
        </Text>
        <Button
          component={Link}
          href="/dashboard"
          variant="gradient"
          gradient={{ from: 'contentHubTeal', to: 'neonViolet', deg: 135 }}
          className={styles.glowButton}
        >
          На главную
        </Button>
      </Stack>
    </Center>
  )
}
