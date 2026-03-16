'use client'

import { useEffect, useState } from 'react'
import {
  Title,
  Stack,
  Group,
  TextInput,
  Button,
  Card,
  Text,
  ActionIcon,
  Pagination,
  Tooltip,
  Modal,
  Badge,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { zodResolver } from 'mantine-form-zod-resolver'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconSearch,
  IconBuilding,
  IconShieldStar,
  IconShare,
} from '@tabler/icons-react'
import { z } from 'zod'

import {
  useCompaniesQuery,
  useCreateCompanyMutation,
  useUpdateCompanyMutation,
  useDeleteCompanyMutation,
} from '@/api/hooks/useCompanies'
import { useAuthStore } from '@/stores/auth-store'
import { useCompanyStore } from '@/stores/company-store'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { EmptyState } from '@/components/shared/EmptyState'
import type { CompanyResponse } from '@/api/client/types.gen'

import styles from './companies.module.css'

const companyNameSchema = z.object({
  name: z.string().min(1, 'Название обязательно').max(255, 'Максимум 255 символов'),
})

type CompanyFormValues = z.infer<typeof companyNameSchema>

// ─── Create Modal ────────────────────────────────────────────────────────────

function CreateCompanyModal({
  opened,
  onClose,
}: {
  opened: boolean
  onClose: () => void
}) {
  const createCompany = useCreateCompanyMutation()

  const form = useForm<CompanyFormValues>({
    mode: 'uncontrolled',
    initialValues: { name: '' },
    validate: zodResolver(companyNameSchema),
  })

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await createCompany.mutateAsync(values)
      form.reset()
      onClose()
      notifications.show({
        title: 'Компания создана',
        message: `Компания "${values.name}" успешно создана`,
        color: 'green',
      })
    } catch {
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось создать компанию',
        color: 'red',
      })
    }
  })

  return (
    <Modal opened={opened} onClose={onClose} title="Новая компания" centered>
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="Название"
            placeholder="Название компании"
            key={form.key('name')}
            {...form.getInputProps('name')}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" loading={createCompany.isPending}>
              Создать
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}

// ─── Edit Modal ──────────────────────────────────────────────────────────────

function EditCompanyModal({
  company,
  onClose,
}: {
  company: CompanyResponse | null
  onClose: () => void
}) {
  const updateCompany = useUpdateCompanyMutation()

  const form = useForm<CompanyFormValues>({
    mode: 'uncontrolled',
    initialValues: { name: company?.name ?? '' },
    validate: zodResolver(companyNameSchema),
  })

  useEffect(() => {
    if (company) {
      form.setValues({ name: company.name })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company])

  const handleSubmit = form.onSubmit(async (values) => {
    if (!company) return
    try {
      await updateCompany.mutateAsync({
        companyId: company.id,
        data: { name: values.name },
      })
      onClose()
      notifications.show({
        title: 'Обновлено',
        message: `Компания переименована в "${values.name}"`,
        color: 'green',
      })
    } catch {
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось обновить компанию',
        color: 'red',
      })
    }
  })

  return (
    <Modal
      opened={!!company}
      onClose={onClose}
      title="Редактировать компанию"
      centered
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="Название"
            placeholder="Название компании"
            key={form.key('name')}
            {...form.getInputProps('name')}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" loading={updateCompany.isPending}>
              Сохранить
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}

// ─── Delete Modal ────────────────────────────────────────────────────────────

function DeleteCompanyModal({
  company,
  onClose,
}: {
  company: CompanyResponse | null
  onClose: () => void
}) {
  const deleteCompany = useDeleteCompanyMutation()

  const handleDelete = async () => {
    if (!company) return
    try {
      await deleteCompany.mutateAsync(company.id)
      onClose()
      notifications.show({
        title: 'Удалено',
        message: `Компания "${company.name}" удалена`,
        color: 'green',
      })
    } catch {
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось удалить компанию. Возможно, есть активные воркспейсы.',
        color: 'red',
      })
    }
  }

  return (
    <Modal
      opened={!!company}
      onClose={onClose}
      title="Удалить компанию"
      centered
    >
      <Stack>
        <Text size="sm">
          Вы уверены, что хотите удалить компанию <strong>{company?.name}</strong>?
          Это действие нельзя отменить.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button
            color="red"
            onClick={handleDelete}
            loading={deleteCompany.isPending}
          >
            Удалить
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

// ─── Company Card ────────────────────────────────────────────────────────────

function CompanyCard({
  company,
  onEdit,
  onDelete,
  onKnowledge,
}: {
  company: CompanyResponse
  onEdit: (company: CompanyResponse) => void
  onDelete: (company: CompanyResponse) => void
  onKnowledge: (company: CompanyResponse) => void
}) {
  return (
    <Card padding="md" radius="md" className={styles.companyCard}>
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <IconBuilding size={20} style={{ color: 'var(--neon-blue)', flexShrink: 0 }} />
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Group gap="xs">
              <Text fw={500} c="gray.1" truncate="end">
                {company.name}
              </Text>
              {company.is_default && (
                <Badge
                  size="xs"
                  variant="light"
                  color="neonBlue"
                  leftSection={<IconShieldStar size={10} />}
                >
                  Default
                </Badge>
              )}
            </Group>
            <Group gap="xs">
              <Text size="xs" c="dimmed">
                slug: {company.slug}
              </Text>
              <Text size="xs" c="dimmed">
                {new Date(company.created_at).toLocaleDateString('ru-RU')}
              </Text>
            </Group>
          </Stack>
        </Group>

        <Group gap="xs" wrap="nowrap">
          <Tooltip label="Граф знаний">
            <ActionIcon
              variant="light"
              color="violet"
              size="sm"
              onClick={() => onKnowledge(company)}
            >
              <IconShare size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Редактировать">
            <ActionIcon
              variant="light"
              color="blue"
              size="sm"
              onClick={() => onEdit(company)}
            >
              <IconPencil size={14} />
            </ActionIcon>
          </Tooltip>
          {!company.is_default && (
            <Tooltip label="Удалить">
              <ActionIcon
                variant="light"
                color="red"
                size="sm"
                onClick={() => onDelete(company)}
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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CompaniesPage() {
  const user = useAuthStore((s) => s.user)
  const setActiveCompany = useCompanyStore((s) => s.setActiveCompany)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const page = Number(searchParams.get('page')) || 1
  const [searchValue, setSearchValue] = useState(searchParams.get('search') ?? '')

  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false)
  const [editCompany, setEditCompany] = useState<CompanyResponse | null>(null)
  const [deleteCompany, setDeleteCompany] = useState<CompanyResponse | null>(null)

  // Guard: redirect non-platform-owners
  useEffect(() => {
    if (user && !user.is_platform_owner) {
      router.replace('/dashboard')
    }
  }, [user, router])

  const { data, isLoading, isError, refetch } = useCompaniesQuery(
    page,
    20,
    searchParams.get('search') || undefined,
  )

  const updateSearchParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  const handleSearch = () => {
    updateSearchParams({ search: searchValue || null, page: null })
  }

  const handlePageChange = (newPage: number) => {
    updateSearchParams({ page: String(newPage) })
  }

  if (!user?.is_platform_owner) return <LoadingState />

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <Title order={2} className={styles.pageTitle}>
          Компании
        </Title>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          Добавить
        </Button>
      </Group>

      {/* Search */}
      <Group gap="xs">
        <TextInput
          placeholder="Поиск по названию..."
          size="sm"
          value={searchValue}
          onChange={(e) => setSearchValue(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          rightSection={
            <ActionIcon variant="subtle" size="sm" onClick={handleSearch}>
              <IconSearch size={14} />
            </ActionIcon>
          }
          style={{ flex: 1, maxWidth: 400 }}
        />
      </Group>

      {/* List */}
      {isLoading && <LoadingState />}
      {isError && <ErrorState onRetry={refetch} />}
      {!isLoading && !isError && (!data || data.items.length === 0) && (
        <EmptyState message="Компании не найдены" />
      )}

      {data && data.items.length > 0 && (
        <Stack gap="sm">
          <Text className={styles.sectionTitle} px="sm">
            {data.total} компаний
          </Text>
          {data.items.map((company) => (
            <CompanyCard
              key={company.id}
              company={company}
              onEdit={setEditCompany}
              onDelete={setDeleteCompany}
              onKnowledge={(c) => {
                setActiveCompany({ id: c.id, name: c.name, slug: c.slug })
                router.push(`/companies/${c.id}/knowledge`)
              }}
            />
          ))}
        </Stack>
      )}

      {/* Pagination */}
      {data && data.pages > 1 && (
        <Group justify="center">
          <Pagination
            total={data.pages}
            value={page}
            onChange={handlePageChange}
          />
        </Group>
      )}

      {/* Modals */}
      <CreateCompanyModal opened={createOpened} onClose={closeCreate} />
      <EditCompanyModal company={editCompany} onClose={() => setEditCompany(null)} />
      <DeleteCompanyModal company={deleteCompany} onClose={() => setDeleteCompany(null)} />
    </Stack>
  )
}
