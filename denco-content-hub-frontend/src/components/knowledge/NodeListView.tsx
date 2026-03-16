'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { IconPlus, IconSearch, IconX } from '@tabler/icons-react'

import { getNodeTypeConfig, NODE_TYPE_OPTIONS, type NodeType } from '@/lib/knowledge-utils'

const DEBOUNCE_MS = 300

const FILTER_OPTIONS = [
  { value: '__all__', label: 'Все типы' },
  ...NODE_TYPE_OPTIONS,
]

interface NodeListItem {
  nodeId: number
  title: string
  nodeType: string
  preview?: string
}

interface NodeListViewProps {
  nodes: NodeListItem[]
  filterType: NodeType | null
  onFilterChange: (value: NodeType | null) => void
  searchQuery: string
  onSearchChange: (value: string) => void
  onNodeSelect: (nodeId: number) => void
  onCreateClick: () => void
}

export function NodeListView({
  nodes,
  filterType,
  onFilterChange,
  searchQuery,
  onSearchChange,
  onNodeSelect,
  onCreateClick,
}: NodeListViewProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLocalSearch(searchQuery)
  }, [searchQuery])

  const handleSearchInput = useCallback(
    (value: string) => {
      setLocalSearch(value)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => onSearchChange(value), DEBOUNCE_MS)
    },
    [onSearchChange],
  )

  const clearSearch = useCallback(() => {
    setLocalSearch('')
    onSearchChange('')
  }, [onSearchChange])

  return (
    <Stack gap="sm" p="sm" style={{ height: '100%', overflow: 'auto' }}>
      <Group gap="xs" wrap="nowrap">
        <Button
          leftSection={<IconPlus size={16} />}
          size="xs"
          variant="light"
          onClick={onCreateClick}
          style={{ flexShrink: 0 }}
        >
          Создать
        </Button>
        <Select
          size="xs"
          w={150}
          data={FILTER_OPTIONS}
          value={filterType ?? '__all__'}
          onChange={(v) => onFilterChange(v === '__all__' ? null : (v as NodeType))}
          allowDeselect={false}
          comboboxProps={{ withinPortal: true }}
          style={{ flexShrink: 0 }}
        />
        <TextInput
          size="xs"
          placeholder="Поиск..."
          leftSection={<IconSearch size={14} />}
          value={localSearch}
          onChange={(e) => handleSearchInput(e.currentTarget.value)}
          rightSection={
            localSearch ? (
              <ActionIcon size="xs" variant="subtle" onClick={clearSearch}>
                <IconX size={12} />
              </ActionIcon>
            ) : null
          }
          style={{ flex: 1 }}
        />
      </Group>

      {nodes.length === 0 ? (
        <Center style={{ flex: 1 }}>
          <Stack align="center" gap="xs">
            <Box
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: 'rgba(130, 130, 220, 0.08)',
                border: '1.5px dashed var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconPlus size={24} color="var(--text-muted)" />
            </Box>
            <Text c="dimmed" size="sm">
              {searchQuery || filterType ? 'Ничего не найдено' : 'Нет узлов — создайте первый'}
            </Text>
          </Stack>
        </Center>
      ) : (
        nodes.map((node) => {
          const config = getNodeTypeConfig(node.nodeType)
          const Icon = config.icon
          return (
            <Card
              key={node.nodeId}
              padding="sm"
              radius="md"
              withBorder
              style={{ cursor: 'pointer', borderColor: 'var(--border-subtle)' }}
              onClick={() => onNodeSelect(node.nodeId)}
            >
              <Group gap="sm" wrap="nowrap">
                <Box
                  style={{
                    background: config.gradient,
                    borderRadius: 8,
                    width: 36,
                    height: 36,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={18} color="white" />
                </Box>
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Group gap="xs" wrap="nowrap">
                    <Text fw={600} size="sm" lineClamp={1} style={{ flex: 1 }}>
                      {node.title}
                    </Text>
                    <Badge size="xs" variant="light" color={config.color} style={{ flexShrink: 0 }}>
                      {config.label}
                    </Badge>
                  </Group>
                  {node.preview && (
                    <Text size="xs" c="dimmed" lineClamp={1} mt={2}>
                      {node.preview}
                    </Text>
                  )}
                </Box>
              </Group>
            </Card>
          )
        })
      )}
    </Stack>
  )
}
