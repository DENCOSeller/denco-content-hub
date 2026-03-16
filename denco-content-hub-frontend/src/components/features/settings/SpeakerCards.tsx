'use client'

import {
  SimpleGrid,
  Card,
  Group,
  Stack,
  Text,
  Avatar,
  Badge,
  ActionIcon,
  Tooltip,
} from '@mantine/core'
import { IconEdit, IconTrash } from '@tabler/icons-react'

import type { KnowledgeNodeResponse } from '@/api/client/types.gen'

interface SpeakerContent {
  position?: string
  style?: string
  notes?: string
  photo_url?: string
  ai_description?: string
}

interface SpeakerCardsProps {
  nodes: KnowledgeNodeResponse[]
  onEdit: (node: KnowledgeNodeResponse) => void
  onDelete: (node: KnowledgeNodeResponse) => void
}

function getSpeakerContent(node: KnowledgeNodeResponse): SpeakerContent {
  if (!node.content) return {}
  return node.content as SpeakerContent
}

export function SpeakerCards({ nodes, onEdit, onDelete }: SpeakerCardsProps) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
      {nodes.map((node) => {
        const sc = getSpeakerContent(node)
        const initials = node.title
          .split(' ')
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()

        return (
          <Card
            key={node.id}
            padding="lg"
            radius="md"
            withBorder
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--card-bg)' }}
          >
            <Stack gap="sm">
              <Group justify="space-between" align="flex-start">
                <Group gap="sm">
                  <Avatar
                    src={sc.photo_url || null}
                    alt={node.title}
                    size={44}
                    radius="xl"
                    color="violet"
                  >
                    {initials}
                  </Avatar>
                  <Stack gap={2}>
                    <Text size="sm" fw={600} c="gray.2" lineClamp={1}>
                      {node.title}
                    </Text>
                    {sc.position && (
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {sc.position}
                      </Text>
                    )}
                  </Stack>
                </Group>
                <Group gap={4} wrap="nowrap">
                  <Tooltip label="Редактировать">
                    <ActionIcon variant="subtle" size="sm" onClick={() => onEdit(node)}>
                      <IconEdit size={14} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Удалить">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      onClick={() => onDelete(node)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>

              {sc.style && (
                <Badge variant="light" color="violet" size="sm" w="fit-content">
                  {sc.style}
                </Badge>
              )}

              {sc.notes && (
                <Text size="xs" c="dimmed" lineClamp={2}>
                  {sc.notes}
                </Text>
              )}

              {(node.usage_count ?? 0) > 0 && (
                <Badge variant="dot" color="gray" size="sm" w="fit-content">
                  Использований: {node.usage_count}
                </Badge>
              )}
            </Stack>
          </Card>
        )
      })}
    </SimpleGrid>
  )
}
