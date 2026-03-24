'use client'

import {
  Card,
  Group,
  Stack,
  Text,
  Badge,
  ActionIcon,
  Tooltip,
} from '@mantine/core'
import {
  IconBuilding,
  IconPencil,
  IconTrash,
  IconShare,
  IconShieldStar,
} from '@tabler/icons-react'

import type { OrganizationResponse } from '@/api/client/types.gen'

import styles from './organizations.module.css'

interface OrganizationCardProps {
  organization: OrganizationResponse
  onEdit: (organization: OrganizationResponse) => void
  onDelete: (organization: OrganizationResponse) => void
  onKnowledge: (organization: OrganizationResponse) => void
}

export function OrganizationCard({
  organization,
  onEdit,
  onDelete,
  onKnowledge,
}: OrganizationCardProps) {
  return (
    <Card padding="md" radius="md" className={styles.organizationCard}>
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" className="flexFill">
          <div className={styles.orgIconWrap}>
            <IconBuilding size={20} color="var(--eco-content)" />
          </div>
          <Stack gap={2} className="flexFill">
            <Group gap="xs">
              <Text fw={500} c="var(--text-primary)" truncate="end">
                {organization.name}
              </Text>
              {organization.is_default && (
                <Badge
                  size="xs"
                  variant="light"
                  color="contentHubTeal"
                  leftSection={<IconShieldStar size={10} />}
                >
                  Default
                </Badge>
              )}
            </Group>
            <Group gap="xs">
              <Text size="xs" c="var(--text-secondary)">
                slug: {organization.slug}
              </Text>
              <Text size="xs" c="var(--text-muted)">
                {new Date(organization.created_at).toLocaleDateString('ru-RU')}
              </Text>
            </Group>
          </Stack>
        </Group>

        <Group gap="xs" wrap="nowrap">
          <Tooltip label="Граф знаний">
            <ActionIcon
              variant="subtle"
              color="violet"
              size="sm"
              onClick={() => onKnowledge(organization)}
            >
              <IconShare size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Редактировать">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={() => onEdit(organization)}
            >
              <IconPencil size={14} />
            </ActionIcon>
          </Tooltip>
          {!organization.is_default && (
            <Tooltip label="Удалить">
              <ActionIcon
                variant="subtle"
                color="red"
                size="sm"
                onClick={() => onDelete(organization)}
              >
                <IconTrash size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>
    </Card>
  )
}
