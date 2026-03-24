'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  Stack,
  Group,
  Text,
  Button,
  Card,
  ActionIcon,
  Tooltip,
  Modal,
  TextInput,
  Textarea,
  Select,
  Badge,
  Checkbox,
  Divider,
  Box,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconShield,
  IconShieldCheck,
} from '@tabler/icons-react'

import { PageHeader } from '@denco/ui'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { pluralize } from '@/utils/pluralize'
import { useOrganizationStore } from '@/stores/organization-store'
import { useSetAiPageContext } from '@/stores/ai-page-store'
import { AppBreadcrumbs } from '@/components/shared/Breadcrumbs'
import { LoadingState } from '@/components/shared/LoadingState'

import {
  useCustomRolesQuery,
  useCreateCustomRoleMutation,
  useUpdateCustomRoleMutation,
  useDeleteCustomRoleMutation,
  PERMISSION_CATEGORIES,
} from '@/api/hooks/useCustomRoles'
import type { CustomRole } from '@/api/hooks/useCustomRoles'

import styles from './roles.module.css'

// --- Base Role Options ---
const BASE_ROLE_OPTIONS = [
  { value: 'org_viewer', label: 'Наблюдатель (org_viewer)' },
  { value: 'org_guest', label: 'Гость (org_guest)' },
  { value: 'org_member', label: 'Участник (org_member)' },
  { value: 'org_admin', label: 'Администратор (org_admin)' },
]

const BASE_ROLE_LABELS: Record<string, string> = {
  org_viewer: 'Наблюдатель',
  org_guest: 'Гость',
  org_member: 'Участник',
  org_admin: 'Администратор',
  org_owner: 'Владелец',
}

const BASE_ROLE_COLORS: Record<string, string> = {
  org_viewer: 'gray',
  org_guest: 'yellow',
  org_member: 'contentHubTeal',
  org_admin: 'blue',
  org_owner: 'violet',
}

// --- Permission Picker ---
function PermissionPicker({
  value,
  onChange,
}: {
  value: string[]
  onChange: (permissions: string[]) => void
}) {
  const toggle = (key: string) => {
    if (value.includes(key)) {
      onChange(value.filter((p) => p !== key))
    } else {
      onChange([...value, key])
    }
  }

  const toggleCategory = (categoryPermissions: readonly { key: string; label: string }[]) => {
    const keys = categoryPermissions.map((p) => p.key)
    const allSelected = keys.every((k) => value.includes(k))
    if (allSelected) {
      onChange(value.filter((p) => !keys.includes(p)))
    } else {
      const newPerms = new Set([...value, ...keys])
      onChange([...newPerms])
    }
  }

  return (
    <Stack gap="xs">
      {PERMISSION_CATEGORIES.map((category) => {
        const keys = category.permissions.map((p) => p.key)
        const allSelected = keys.every((k) => value.includes(k))
        const someSelected = keys.some((k) => value.includes(k))

        return (
          <Box key={category.label} className={styles.permissionCategory}>
            <Checkbox
              label={
                <Text size="sm" fw={500}>{category.label}</Text>
              }
              checked={allSelected}
              indeterminate={someSelected && !allSelected}
              onChange={() => toggleCategory(category.permissions)}
              mb="xs"
            />
            <Stack gap={4} pl="lg">
              {category.permissions.map((perm) => (
                <Checkbox
                  key={perm.key}
                  label={<Text size="xs">{perm.label}</Text>}
                  checked={value.includes(perm.key)}
                  onChange={() => toggle(perm.key)}
                  size="xs"
                />
              ))}
            </Stack>
          </Box>
        )
      })}
    </Stack>
  )
}

// --- Slug generator ---
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[а-яё]/g, (c) => {
      const map: Record<string, string> = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
      }
      return map[c] ?? c
    })
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 50)
}

// --- Create/Edit Role Modal ---
function RoleFormModal({
  opened,
  role,
  onClose,
  orgId,
}: {
  opened: boolean
  role: CustomRole | null
  onClose: () => void
  orgId: number
}) {
  const isEdit = !!role
  const isMobile = useMediaQuery('(max-width: 48em)')
  const createRole = useCreateCustomRoleMutation(orgId)
  const updateRole = useUpdateCustomRoleMutation(orgId)

  const form = useForm({
    initialValues: {
      name: role?.name ?? '',
      slug: role?.slug ?? '',
      description: role?.description ?? '',
      base_role: role?.base_role ?? 'org_member',
      permissions: role?.permissions ?? [] as string[],
    },
    validate: {
      name: (v) => (v.trim().length < 1 ? 'Название обязательно' : null),
      slug: (v) => (v.trim().length < 1 ? 'Slug обязателен' : null),
      base_role: (v) => (!v ? 'Выберите базовую роль' : null),
    },
  })

  // Sync form on role change
  useEffect(() => {
    if (role) {
      form.setValues({
        name: role.name,
        slug: role.slug,
        description: role.description ?? '',
        base_role: role.base_role,
        permissions: role.permissions ?? [],
      })
      form.resetDirty()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role?.id])

  const handleNameChange = (name: string) => {
    form.setFieldValue('name', name)
    if (!isEdit && !form.isDirty('slug')) {
      form.setFieldValue('slug', generateSlug(name))
    }
  }

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      if (isEdit && role) {
        await updateRole.mutateAsync({
          roleId: role.id,
          data: {
            name: values.name.trim(),
            description: values.description.trim() || undefined,
            base_role: values.base_role,
            permissions: values.permissions,
          },
        })
        notifications.show({
          title: 'Обновлено',
          message: `Роль "${values.name}" обновлена`,
          color: 'green',
        })
      } else {
        await createRole.mutateAsync({
          name: values.name.trim(),
          slug: values.slug.trim(),
          description: values.description.trim() || undefined,
          base_role: values.base_role,
          permissions: values.permissions,
        })
        notifications.show({
          title: 'Роль создана',
          message: `Роль "${values.name}" создана`,
          color: 'green',
        })
      }
      form.reset()
      onClose()
    } catch (err) {
      notifications.show({
        title: 'Ошибка',
        message: (err as Error).message || 'Не удалось сохранить роль',
        color: 'red',
      })
    }
  })

  const isPending = createRole.isPending || updateRole.isPending

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? 'Редактировать роль' : 'Новая роль'}
      centered={!isMobile}
      fullScreen={isMobile}
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="Название"
            placeholder="Менеджер контента"
            value={form.values.name}
            onChange={(e) => handleNameChange(e.currentTarget.value)}
            error={form.errors.name}
          />
          <TextInput
            label="Slug"
            placeholder="content_manager"
            disabled={isEdit}
            {...form.getInputProps('slug')}
          />
          <Textarea
            label="Описание"
            placeholder="Опишите назначение роли"
            autosize
            minRows={2}
            maxRows={4}
            {...form.getInputProps('description')}
          />
          <Select
            label="Базовая роль"
            description="Определяет начальный набор прав"
            data={BASE_ROLE_OPTIONS}
            {...form.getInputProps('base_role')}
          />

          <Divider label="Права доступа" labelPosition="center" />

          <PermissionPicker
            value={form.values.permissions}
            onChange={(perms) => form.setFieldValue('permissions', perms)}
          />

          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>Отмена</Button>
            <Button type="submit" loading={isPending}>
              {isEdit ? 'Сохранить' : 'Создать'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}

// --- Delete Role Modal ---
function DeleteRoleModal({
  role,
  onClose,
  orgId,
}: {
  role: CustomRole | null
  onClose: () => void
  orgId: number
}) {
  const deleteRole = useDeleteCustomRoleMutation(orgId)

  const handleDelete = async () => {
    if (!role) return
    try {
      await deleteRole.mutateAsync(role.id)
      onClose()
      notifications.show({
        title: 'Удалено',
        message: `Роль "${role.name}" удалена`,
        color: 'green',
      })
    } catch (err) {
      notifications.show({
        title: 'Ошибка',
        message: (err as Error).message || 'Не удалось удалить роль',
        color: 'red',
      })
    }
  }

  return (
    <Modal opened={!!role} onClose={onClose} title="Удалить роль" centered>
      <Stack>
        <Text size="sm">
          Удалить роль <strong>{role?.name}</strong>? Пользователи с этой ролью будут переведены на базовую роль.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Отмена</Button>
          <Button color="red" onClick={handleDelete} loading={deleteRole.isPending}>Удалить</Button>
        </Group>
      </Stack>
    </Modal>
  )
}

// --- Role Card ---
function RoleCard({
  role,
  onEdit,
  onDelete,
}: {
  role: CustomRole
  onEdit: (r: CustomRole) => void
  onDelete: (r: CustomRole) => void
}) {
  return (
    <Card padding="md" radius="md" className={styles.roleCard}>
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" className="flexFill">
          <div className={styles.roleIconWrap}>
            <IconShield size={18} color="var(--eco-content)" />
          </div>
          <Stack gap={2} className="flexFill">
            <Group gap="xs">
              <Text fw={500} c="var(--text-primary)" truncate="end">
                {role.name}
              </Text>
              <Badge
                size="xs"
                variant="light"
                color={BASE_ROLE_COLORS[role.base_role] ?? 'gray'}
              >
                {BASE_ROLE_LABELS[role.base_role] ?? role.base_role}
              </Badge>
            </Group>
            <Group gap="xs">
              <Text size="xs" c="var(--text-secondary)">
                slug: {role.slug}
              </Text>
              {role.description && (
                <Text size="xs" c="var(--text-muted)" truncate="end" maw={300}>
                  {role.description}
                </Text>
              )}
              <Badge size="xs" variant="dot" color="contentHubTeal">
                {role.permissions?.length ?? 0} {pluralize(role.permissions?.length ?? 0, 'право', 'права', 'прав')}
              </Badge>
            </Group>
          </Stack>
        </Group>

        <Group gap="xs" wrap="nowrap">
          <Tooltip label="Редактировать">
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => onEdit(role)}>
              <IconPencil size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Удалить">
            <ActionIcon variant="subtle" color="red" size="sm" onClick={() => onDelete(role)}>
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Card>
  )
}

// --- Page ---
export default function CustomRolesPage() {
  const params = useParams()
  const orgId = Number(params.id)
  const activeOrganization = useOrganizationStore((s) => s.activeOrganization)

  useSetAiPageContext({ page_type: 'dashboard', company_id: orgId })

  const [formOpened, { open: openForm, close: closeForm }] = useDisclosure(false)
  const [editRole, setEditRole] = useState<CustomRole | null>(null)
  const [deleteRole, setDeleteRole] = useState<CustomRole | null>(null)

  const { data: roles, isLoading, isError, refetch } = useCustomRolesQuery(orgId)

  const breadcrumbs = [
    { label: 'Организации', href: '/organizations' },
    { label: activeOrganization?.name ?? 'Организация', href: `/organizations/${orgId}` },
    { label: 'Роли' },
  ]

  const handleEdit = (role: CustomRole) => {
    setEditRole(role)
    openForm()
  }

  const handleCloseForm = () => {
    setEditRole(null)
    closeForm()
  }

  return (
    <Stack gap="lg">
      <AppBreadcrumbs items={breadcrumbs} />

      <PageHeader
        title="Кастомные роли"
        subtitle="Настройка ролей и прав доступа"
        actions={[
          <Button
            key="create"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setEditRole(null)
              openForm()
            }}
          >
            Создать роль
          </Button>,
        ]}
      />

      {/* System roles info */}
      <Card padding="sm" radius="md" className={styles.infoCard}>
        <Group gap="xs">
          <IconShieldCheck size={16} color="var(--eco-content)" />
          <Text size="xs" c="var(--text-secondary)">
            Системные роли: Владелец, Администратор, Участник, Наблюдатель, Гость.
            Кастомные роли наследуют права базовой роли и могут добавлять дополнительные.
          </Text>
        </Group>
      </Card>

      {isLoading && <LoadingState message="Загрузка ролей..." />}
      {isError && <ErrorState message="Не удалось загрузить роли" onRetry={refetch} />}

      {!isLoading && !isError && (!roles || roles.length === 0) && (
        <EmptyState message="Кастомные роли не созданы. Используйте системные роли или создайте свою." />
      )}

      {roles && roles.length > 0 && (
        <Stack gap="sm">
          <Text className={styles.sectionTitle} px="sm">
            {roles.length} {pluralize(roles.length, 'кастомная роль', 'кастомные роли', 'кастомных ролей')}
          </Text>
          {roles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              onEdit={handleEdit}
              onDelete={setDeleteRole}
            />
          ))}
        </Stack>
      )}

      <RoleFormModal
        opened={formOpened}
        role={editRole}
        onClose={handleCloseForm}
        orgId={orgId}
      />
      <DeleteRoleModal
        role={deleteRole}
        onClose={() => setDeleteRole(null)}
        orgId={orgId}
      />
    </Stack>
  )
}
