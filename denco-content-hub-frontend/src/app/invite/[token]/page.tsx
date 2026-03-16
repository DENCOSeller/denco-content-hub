'use client'

import { useParams, useRouter } from 'next/navigation'
import {
  Center,
  Card,
  Stack,
  Title,
  Text,
  Badge,
  Button,
  Alert,
  Loader,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconCheck, IconLogin, IconUserPlus } from '@tabler/icons-react'
import Link from 'next/link'

import { useInvitationInfoQuery, useAcceptInvitationMutation } from '@/api/hooks/useTeam'
import { isAuthenticated } from '@/lib/auth'

const roleLabelMap: Record<string, string> = {
  owner: 'Владелец',
  admin: 'Админ',
  editor: 'Редактор',
  viewer: 'Просмотр',
  contractor: 'Подрядчик',
}

const roleColorMap: Record<string, string> = {
  owner: 'blue',
  admin: 'violet',
  editor: 'green',
  viewer: 'gray',
  contractor: 'orange',
}

export default function InvitePage() {
  const params = useParams<{ token: string }>()
  const token = params.token
  const router = useRouter()

  const { data: invitation, isLoading, isError } = useInvitationInfoQuery(token)
  const acceptInvitation = useAcceptInvitationMutation()

  const authed = isAuthenticated()
  const redirectPath = `/invite/${token}`

  const handleAccept = async () => {
    try {
      await acceptInvitation.mutateAsync(token)
      notifications.show({
        title: 'Готово!',
        message: `Вы вступили в воркспейс`,
        color: 'green',
      })
      router.push('/dashboard')
    } catch (err: unknown) {
      const detail =
        err && typeof err === 'object' && 'detail' in err
          ? String((err as { detail: string }).detail)
          : 'Не удалось принять приглашение'
      notifications.show({
        title: 'Ошибка',
        message: detail,
        color: 'red',
      })
    }
  }

  if (!authed) {
    return (
      <Center mih="100vh" p="md">
        <Card
          padding="xl"
          radius="md"
          withBorder
          style={{ maxWidth: 440, width: '100%' }}
        >
          <Stack gap="lg" align="center">
            <Title order={3} ta="center">
              Приглашение в воркспейс
            </Title>
            <Text c="dimmed" size="sm" ta="center">
              Для принятия приглашения войдите или зарегистрируйтесь
            </Text>
            <Button
              component={Link}
              href={`/login?redirect=${encodeURIComponent(redirectPath)}`}
              fullWidth
              leftSection={<IconLogin size={18} />}
            >
              Войти
            </Button>
            <Button
              component={Link}
              href={`/register?redirect=${encodeURIComponent(redirectPath)}`}
              fullWidth
              variant="light"
              leftSection={<IconUserPlus size={18} />}
            >
              Зарегистрироваться
            </Button>
          </Stack>
        </Card>
      </Center>
    )
  }

  return (
    <Center mih="100vh" p="md">
      <Card
        padding="xl"
        radius="md"
        withBorder
        style={{ maxWidth: 440, width: '100%' }}
      >
        {isLoading && (
          <Stack align="center" gap="sm" py="xl">
            <Loader size="lg" />
            <Text c="dimmed" size="sm">Загрузка приглашения...</Text>
          </Stack>
        )}

        {isError && (
          <Alert icon={<IconAlertCircle />} color="red" title="Приглашение недействительно">
            Ссылка устарела, уже использована или не существует.
          </Alert>
        )}

        {invitation && (
          <Stack gap="lg" align="center">
            <Stack gap="xs" align="center">
              <Title order={3} ta="center">
                Приглашение в воркспейс
              </Title>
              <Text fw={600} size="xl" c="blue">
                {invitation.workspace_name}
              </Text>
            </Stack>

            <Stack gap="xs" align="center">
              <Text c="dimmed" size="sm">Вас приглашают как</Text>
              <Badge
                color={roleColorMap[invitation.role] ?? 'gray'}
                variant="light"
                size="lg"
              >
                {roleLabelMap[invitation.role] ?? invitation.role}
              </Badge>
            </Stack>

            <Text size="xs" c="dimmed" ta="center">
              Инвайт действителен до{' '}
              {new Date(invitation.expires_at).toLocaleDateString('ru-RU')}
            </Text>

            <Button
              fullWidth
              size="md"
              leftSection={<IconCheck size={18} />}
              onClick={handleAccept}
              loading={acceptInvitation.isPending}
            >
              Принять приглашение
            </Button>
          </Stack>
        )}
      </Card>
    </Center>
  )
}
