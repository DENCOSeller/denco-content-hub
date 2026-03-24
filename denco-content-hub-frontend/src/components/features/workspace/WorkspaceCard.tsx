'use client'

import { Card, Text, Group, Badge, Stack, Menu, ActionIcon } from '@mantine/core'
import { IconBriefcase, IconDots, IconPencil, IconTrash } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import type { WorkspaceResponse, WorkspaceRole } from '@/api/client/types.gen'

import styles from '@/app/(dashboard)/dashboard.module.css'

const roleColorMap: Record<WorkspaceRole, string> = {
  owner: 'neonViolet',
  admin: 'contentHubTeal',
  editor: 'green',
  viewer: 'gray',
  contractor: 'orange',
}

const roleLabelMap: Record<WorkspaceRole, string> = {
  owner: 'Владелец',
  admin: 'Админ',
  editor: 'Редактор',
  viewer: 'Читатель',
  contractor: 'Подрядчик',
}

interface WorkspaceCardProps {
  workspace: WorkspaceResponse
  onEdit?: (workspace: WorkspaceResponse) => void
  onDelete?: (workspace: WorkspaceResponse) => void
}

export function WorkspaceCard({ workspace, onEdit, onDelete }: WorkspaceCardProps) {
  const router = useRouter()
  const canManage = workspace.role === 'owner' || workspace.role === 'admin'

  return (
    <Card
      padding="lg"
      radius="md"
      className={styles.workspaceCard}
      onClick={() => router.push(`/workspaces/${workspace.id}`)}
    >
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <Group gap="xs" wrap="nowrap" className="flexFill">
            <IconBriefcase size={20} style={{ color: 'var(--content-hub-teal)', flexShrink: 0 }} />
            <Text fw={600} c="gray.1" truncate="end">
              {workspace.name}
            </Text>
          </Group>
          <Group gap={4} wrap="nowrap">
            {workspace.is_personal && (
              <Badge size="xs" variant="light" color="contentHubTeal">
                Личный
              </Badge>
            )}
            <Badge size="xs" variant="light" color={roleColorMap[workspace.role]}>
              {roleLabelMap[workspace.role]}
            </Badge>
            {canManage && (
              <Menu shadow="md" width={180} position="bottom-end">
                <Menu.Target>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <IconDots size={16} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
                  <Menu.Item
                    leftSection={<IconPencil size={14} />}
                    onClick={() => onEdit?.(workspace)}
                  >
                    Переименовать
                  </Menu.Item>
                  {workspace.role === 'owner' && (
                    <Menu.Item
                      color="red"
                      leftSection={<IconTrash size={14} />}
                      onClick={() => onDelete?.(workspace)}
                    >
                      Удалить
                    </Menu.Item>
                  )}
                </Menu.Dropdown>
              </Menu>
            )}
          </Group>
        </Group>

        {workspace.company_name && (
          <Text size="xs" c="dimmed">
            {workspace.company_name}
          </Text>
        )}

        <Text size="xs" c="dimmed">
          {new Date(workspace.created_at).toLocaleDateString('ru-RU')}
        </Text>
      </Stack>
    </Card>
  )
}
