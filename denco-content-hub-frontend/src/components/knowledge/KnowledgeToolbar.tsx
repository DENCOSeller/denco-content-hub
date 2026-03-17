'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { ActionIcon, Button, Group, Menu, Select, Text, TextInput, Tooltip, Divider } from '@mantine/core'
import { IconPlus, IconMaximize, IconSearch, IconX, IconLayoutDashboard, IconBinaryTree, IconAtom, IconAdjustments, IconLayoutGrid, IconBrain, IconShare } from '@tabler/icons-react'
import { motion } from 'motion/react'

import type { NodeType } from '@/lib/knowledge-utils'
import type { KnowledgeScope } from '@/hooks/useKnowledgeGraph'
import type { DisplayMode } from './KnowledgeGraph'
import { useNodeTypeConfig } from '@/hooks/useNodeTypeConfig'
import { useCompanyStore } from '@/stores/company-store'
import { ShareGraphModal } from './ShareGraphModal'

const DEBOUNCE_MS = 300

const STATUS_OPTIONS = [
  { value: '__all__', label: 'Все статусы' },
  { value: 'active', label: 'Активные' },
  { value: 'draft', label: 'Черновики' },
  { value: 'deprecated', label: 'Устаревшие' },
  { value: 'archived', label: 'Архив' },
]

interface KnowledgeToolbarProps {
  scope: KnowledgeScope
  scopeId: number
  filterType: NodeType | null
  onFilterChange: (value: NodeType | null) => void
  filterStatus: string | null
  onFilterStatusChange: (value: string | null) => void
  searchQuery: string
  onSearchChange: (value: string) => void
  onCreateClick: () => void
  onAutoLayout: (algorithm: 'dagre' | 'force') => void
  onManageTypes?: () => void
  displayMode?: DisplayMode
  onSwitchMode?: (mode: DisplayMode) => void
}

export function KnowledgeToolbar({
  scope,
  scopeId,
  filterType,
  onFilterChange,
  filterStatus,
  onFilterStatusChange,
  searchQuery,
  onSearchChange,
  onCreateClick,
  onAutoLayout,
  onManageTypes,
  displayMode = 'free',
  onSwitchMode,
}: KnowledgeToolbarProps) {
  const { fitView } = useReactFlow()
  const activeCompany = useCompanyStore((s) => s.activeCompany)
  const companyId = scope === 'company' ? scopeId : (activeCompany?.id ?? 0)
  const { typeOptions } = useNodeTypeConfig(companyId)
  const [shareOpened, setShareOpened] = useState(false)

  const filterOptions = useMemo(
    () => [{ value: '__all__', label: 'Все типы' }, ...typeOptions],
    [typeOptions],
  )

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
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <Group
        px="md"
        py={10}
        gap="sm"
        wrap="nowrap"
        style={{
          background: 'rgba(15, 15, 35, 0.65)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: 10,
          border: '1px solid var(--border-subtle)',
        }}
      >
        <Tooltip label="Создать новый узел" withArrow>
          <Button
            leftSection={<IconPlus size={16} />}
            size="xs"
            variant="light"
            onClick={onCreateClick}
          >
            Создать узел
          </Button>
        </Tooltip>

        <Tooltip label="Фильтр по типу узла" withArrow>
          <Select
            size="xs"
            w={180}
            data={filterOptions}
            value={filterType ?? '__all__'}
            onChange={(v) => onFilterChange(v === '__all__' ? null : (v as NodeType))}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true }}
          />
        </Tooltip>

        <Tooltip label="Фильтр по статусу" withArrow>
          <Select
            size="xs"
            w={160}
            data={STATUS_OPTIONS}
            value={filterStatus ?? '__all__'}
            onChange={(v) => onFilterStatusChange(v === '__all__' ? null : v)}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true }}
          />
        </Tooltip>

        <TextInput
          size="xs"
          w={200}
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
        />

        <Divider orientation="vertical" />
        <Tooltip label="Поделиться" withArrow>
          <ActionIcon size="md" variant="subtle" onClick={() => setShareOpened(true)}>
            <IconShare size={16} />
          </ActionIcon>
        </Tooltip>

        {scope === 'company' && onManageTypes && (
          <>
            <Tooltip label="Управление типами" withArrow>
              <ActionIcon size="md" variant="subtle" onClick={onManageTypes}>
                <IconAdjustments size={16} />
              </ActionIcon>
            </Tooltip>
          </>
        )}

        <Divider orientation="vertical" />
        <Group gap={4}>
          <Tooltip label="Свободный режим" withArrow>
            <ActionIcon
              size="md"
              variant={displayMode === 'free' ? 'filled' : 'subtle'}
              onClick={() => onSwitchMode?.('free')}
            >
              <IconLayoutGrid size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Дерево" withArrow>
            <ActionIcon
              size="md"
              variant={displayMode === 'tree' ? 'filled' : 'subtle'}
              onClick={() => onSwitchMode?.('tree')}
            >
              <IconBinaryTree size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Карта идей" withArrow>
            <ActionIcon
              size="md"
              variant={displayMode === 'mindmap' ? 'filled' : 'subtle'}
              onClick={() => onSwitchMode?.('mindmap')}
            >
              <IconBrain size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <Divider orientation="vertical" />
        <Menu shadow="md" width={240} position="bottom-end" withArrow>
          <Menu.Target>
            <Tooltip label="Авто-раскладка" withArrow>
              <ActionIcon size="md" variant="subtle">
                <IconLayoutDashboard size={16} />
              </ActionIcon>
            </Tooltip>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Авто-раскладка</Menu.Label>
            <Menu.Item
              leftSection={<IconBinaryTree size={16} />}
              onClick={() => onAutoLayout('dagre')}
            >
              <div>
                <Text size="sm">Иерархическая</Text>
                <Text size="xs" c="dimmed">Сверху вниз по связям</Text>
              </div>
            </Menu.Item>
            <Menu.Item
              leftSection={<IconAtom size={16} />}
              onClick={() => onAutoLayout('force')}
            >
              <div>
                <Text size="sm">Органическая</Text>
                <Text size="xs" c="dimmed">Кластеры по связности</Text>
              </div>
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>

        <Tooltip label="Вместить всё" withArrow>
          <ActionIcon
            size="md"
            variant="subtle"
            onClick={() => fitView({ padding: 0.2, duration: 300 })}
          >
            <IconMaximize size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <ShareGraphModal
        opened={shareOpened}
        onClose={() => setShareOpened(false)}
        scope={scope}
        scopeId={scopeId}
      />
    </motion.div>
  )
}
