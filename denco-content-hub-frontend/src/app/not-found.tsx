import { Button, Center, Stack, Text, Title } from '@mantine/core'
import Link from 'next/link'

export default function NotFound() {
  return (
    <Center mih="100vh" bg="var(--app-bg)">
      <Stack align="center" gap="md">
        <Title
          order={1}
          fz={80}
          fw={800}
          style={{
            background: 'linear-gradient(135deg, #0A84FF, #BF5AF2)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          404
        </Title>
        <Text c="dimmed" size="lg">
          Страница не найдена
        </Text>
        <Button
          component={Link}
          href="/dashboard"
          variant="gradient"
          gradient={{ from: '#0A84FF', to: '#BF5AF2', deg: 135 }}
          style={{
            boxShadow: '0 0 20px rgba(10, 132, 255, 0.3)',
          }}
        >
          На главную
        </Button>
      </Stack>
    </Center>
  )
}
