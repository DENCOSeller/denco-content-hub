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
  IconUsers,
  IconPencil,
  IconTrash,
} from '@tabler/icons-react'

import type { StaffTeam } from '@/api/hooks/useStaffTeams'

import styles from './teams.module.css'

interface TeamCardProps {
  team: StaffTeam
  onEdit: (t: StaffTeam) => void
  onDelete: (t: StaffTeam) => void
  onSelect: (t: StaffTeam) => void
}

export function TeamCard({ team, onEdit, onDelete, onSelect }: TeamCardProps) {
  return (
    <Card
      padding="md"
      radius="md"
      className={styles.teamCard}
      onClick={() => onSelect(team)}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" className="flexFill">
          <div className={styles.teamIconWrap}>
            <IconUsers size={18} color="var(--eco-content)" />
          </div>
          <Stack gap={2} className="flexFill">
            <Text fw={500} c="var(--text-primary)" truncate="end">
              {team.name}
            </Text>
            <Group gap="xs">
              {team.description && (
                <Text size="xs" c="var(--text-secondary)" truncate="end" maw={300}>
                  {team.description}
                </Text>
              )}
              <Badge size="xs" variant="light" color="contentHubTeal">
                {team.member_count} уч.
              </Badge>
            </Group>
          </Stack>
        </Group>

        <Group gap="xs" wrap="nowrap" onClick={(e) => e.stopPropagation()}>
          <Tooltip label="Редактировать">
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => onEdit(team)}>
              <IconPencil size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Удалить">
            <ActionIcon variant="subtle" color="red" size="sm" onClick={() => onDelete(team)}>
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Card>
  )
}
