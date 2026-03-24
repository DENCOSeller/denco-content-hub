'use client'

import { useState, useMemo } from 'react'
import {
  Stack,
  Text,
  Table,
  Select,
  TextInput,
  Pagination,
  Badge,
  Card,
  Collapse,
  UnstyledButton,
  Box,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import {
  IconSearch,
  IconChevronDown,
  IconChevronRight,
} from '@tabler/icons-react'

import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { EmptyState } from '@/components/shared/EmptyState'

import type { AuditLogItem, AuditLogParams } from '@/api/hooks/useAuditLog'
import {
  getActionLabel,
  getResourceTypeLabel,
  ACTION_LABELS,
  RESOURCE_TYPE_LABELS,
} from '@/api/hooks/useAuditLog'

import styles from './AuditLogTable.module.css'

// --- Types ---

interface AuditLogTableProps {
  data: { items: AuditLogItem[]; total: number } | undefined
  isLoading: boolean
  isError: boolean
  refetch: () => void
  params: AuditLogParams
  onParamsChange: (params: Partial<AuditLogParams>) => void
}

// --- Page size options ---

const PAGE_SIZE_OPTIONS = [
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
]

// --- Filter options ---

const ACTION_OPTIONS = [
  { value: '', label: 'Все действия' },
  ...Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label })),
]

const RESOURCE_TYPE_OPTIONS = [
  { value: '', label: 'Все ресурсы' },
  ...Object.entries(RESOURCE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
]

// --- Action badge class ---

function getActionBadgeClass(action: string): string {
  if (action.startsWith('auth.')) return styles.badgeAuth
  if (action.includes('delete') || action.includes('remove')) return styles.badgeDestructive
  if (action.includes('create') || action.includes('add')) return styles.badgePositive
  if (action.includes('update') || action.includes('change')) return styles.badgeUpdate
  return styles.badgeNeutral
}

// --- Details row ---

function DetailsCell({ details }: { details: Record<string, unknown> | null }) {
  const [opened, setOpened] = useState(false)

  if (!details || Object.keys(details).length === 0) {
    return <Text size="xs" c="dimmed">&mdash;</Text>
  }

  return (
    <Box>
      <UnstyledButton onClick={() => setOpened((o) => !o)} className={styles.detailsToggle}>
        {opened ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
        <span>{Object.keys(details).length} полей</span>
      </UnstyledButton>
      <Collapse in={opened}>
        <pre className={styles.detailsCode}>
          {JSON.stringify(details, null, 2)}
        </pre>
      </Collapse>
    </Box>
  )
}

// --- Format dates ---

function formatDateFull(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// --- Main component ---

export function AuditLogTable({
  data,
  isLoading,
  isError,
  refetch,
  params,
  onParamsChange,
}: AuditLogTableProps) {
  const [actorSearch, setActorSearch] = useState('')

  const pageSize = params.limit ?? 25
  const currentPage = Math.floor((params.skip ?? 0) / pageSize) + 1
  const totalPages = data ? Math.ceil(data.total / pageSize) : 0

  const handlePageChange = (page: number) => {
    onParamsChange({ skip: (page - 1) * pageSize })
  }

  const handlePageSizeChange = (value: string | null) => {
    const newSize = Number(value) || 25
    onParamsChange({ limit: newSize, skip: 0 })
  }

  const handleActionChange = (value: string | null) => {
    onParamsChange({ action: value || undefined, skip: 0 })
  }

  const handleResourceTypeChange = (value: string | null) => {
    onParamsChange({ resource_type: value || undefined, skip: 0 })
  }

  const handleDateFromChange = (value: string | null) => {
    onParamsChange({
      date_from: value ?? undefined,
      skip: 0,
    })
  }

  const handleDateToChange = (value: string | null) => {
    onParamsChange({
      date_to: value ?? undefined,
      skip: 0,
    })
  }

  const dateFrom = params.date_from ?? null
  const dateTo = params.date_to ?? null

  // Client-side email filter (since API only supports actor_id)
  const filteredItems = useMemo(() => {
    if (!data?.items) return []
    if (!actorSearch.trim()) return data.items
    const search = actorSearch.toLowerCase()
    return data.items.filter((item) =>
      item.actor_email.toLowerCase().includes(search),
    )
  }, [data?.items, actorSearch])

  return (
    <Stack gap="md">
      {/* Filters */}
      <Card padding="md" radius="md" className={styles.filtersCard}>
        <div className={styles.filtersGroup}>
          <Select
            placeholder="Действие"
            data={ACTION_OPTIONS}
            value={params.action ?? ''}
            onChange={handleActionChange}
            size="sm"
            clearable
            w={220}
          />
          <Select
            placeholder="Тип ресурса"
            data={RESOURCE_TYPE_OPTIONS}
            value={params.resource_type ?? ''}
            onChange={handleResourceTypeChange}
            size="sm"
            clearable
            w={180}
          />
          <DatePickerInput
            placeholder="Дата от"
            value={dateFrom}
            onChange={handleDateFromChange}
            size="sm"
            clearable
            w={160}
            valueFormat="DD.MM.YYYY"
            locale="ru"
          />
          <DatePickerInput
            placeholder="Дата до"
            value={dateTo}
            onChange={handleDateToChange}
            size="sm"
            clearable
            w={160}
            valueFormat="DD.MM.YYYY"
            locale="ru"
          />
          <TextInput
            placeholder="Поиск по email..."
            value={actorSearch}
            onChange={(e) => setActorSearch(e.currentTarget.value)}
            rightSection={<IconSearch size={14} />}
            size="sm"
            w={220}
          />
        </div>
      </Card>

      {/* Content */}
      {isLoading && <LoadingState message="Загрузка журнала..." />}
      {isError && <ErrorState message="Не удалось загрузить журнал действий" onRetry={refetch} />}

      {!isLoading && !isError && (!data || data.items.length === 0) && (
        <EmptyState message="Записи не найдены" />
      )}

      {!isLoading && !isError && data && data.items.length > 0 && (
        <>
          <div className={styles.tableControls}>
            <span className={styles.recordCount}>
              {data.total} записей
            </span>
            <div className={styles.pageSizeGroup}>
              <span className={styles.pageSizeLabel}>На странице:</span>
              <Select
                data={PAGE_SIZE_OPTIONS}
                value={String(pageSize)}
                onChange={handlePageSizeChange}
                size="xs"
                w={70}
              />
            </div>
          </div>

          <div className={styles.tableWrapper}>
            <Table className={styles.auditTable}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Дата</Table.Th>
                  <Table.Th>Пользователь</Table.Th>
                  <Table.Th>Действие</Table.Th>
                  <Table.Th>Ресурс</Table.Th>
                  <Table.Th>Детали</Table.Th>
                  <Table.Th>IP</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredItems.map((item) => (
                  <Table.Tr key={item.id}>
                    <Table.Td>
                      <span className={styles.dateCell}>
                        <span className={styles.dateFull}>{formatDateFull(item.created_at)}</span>
                        <span className={styles.dateShort}>{formatDateShort(item.created_at)}</span>
                      </span>
                    </Table.Td>
                    <Table.Td>
                      <span className={styles.emailCell} title={item.actor_email}>
                        {item.actor_email}
                      </span>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        size="sm"
                        variant="light"
                        className={getActionBadgeClass(item.action)}
                      >
                        {getActionLabel(item.action)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <div className={styles.resourceGroup}>
                        <span className={styles.resourceType}>
                          {getResourceTypeLabel(item.resource_type)}
                        </span>
                        {item.resource_id !== null && (
                          <span className={styles.resourceId}>
                            #{item.resource_id}
                          </span>
                        )}
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <DetailsCell details={item.details} />
                    </Table.Td>
                    <Table.Td>
                      <span className={styles.ipCell}>
                        {item.ip_address ?? '\u2014'}
                      </span>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={styles.paginationWrapper}>
              <Pagination
                total={totalPages}
                value={currentPage}
                onChange={handlePageChange}
              />
            </div>
          )}
        </>
      )}
    </Stack>
  )
}
