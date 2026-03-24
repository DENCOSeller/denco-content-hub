'use client'

import { Menu, UnstyledButton, Group, Text, Avatar, Loader, Tooltip } from '@mantine/core'
import { IconBuilding, IconCheck, IconSelector } from '@tabler/icons-react'

import { useAuthStore } from '@/stores/auth-store'
import { useOrganizationsQuery } from '@/api/hooks/useOrganizations'
import { useOrgSwitcher } from '@/api/hooks/useOrgSwitcher'
import { useOrganizationStore } from '@/stores/organization-store'
import styles from './OrganizationSwitcher.module.css'

/**
 * Organization Switcher — dual mode:
 * 1. Platform owner: uses admin API to filter data by organization
 * 2. Regular user with JWT v3 available_orgs: calls switch-org to get new tokens
 */
export function OrganizationSwitcher() {
  const user = useAuthStore((s) => s.user)
  const isPlatformOwner = !!user?.is_platform_owner

  if (isPlatformOwner) {
    return <PlatformOwnerSwitcher />
  }

  return <JwtOrgSwitcher />
}

/**
 * Platform owner mode: filter view by organization (existing behavior).
 */
function PlatformOwnerSwitcher() {
  const { data: organizationsData } = useOrganizationsQuery(1, 100)
  const activeOrganization = useOrganizationStore((s) => s.activeOrganization)
  const setActiveOrganization = useOrganizationStore((s) => s.setActiveOrganization)
  const clearActiveOrganization = useOrganizationStore((s) => s.clearActiveOrganization)

  const organizations = organizationsData?.items ?? []
  if (organizations.length === 0) return null

  const handleSelect = (orgId: number) => {
    if (activeOrganization?.id === orgId) {
      clearActiveOrganization()
      return
    }
    const org = organizations.find((o) => o.id === orgId)
    if (org) {
      setActiveOrganization({ id: org.id, name: org.name, slug: org.slug })
    }
  }

  return (
    <OrgSwitcherMenu
      activeOrgId={activeOrganization?.id ?? null}
      activeOrgName={activeOrganization?.name ?? 'Все организации'}
      organizations={organizations.map((o) => ({ id: o.id, name: o.name, slug: o.slug }))}
      onSelect={handleSelect}
      isSwitching={false}
      showAllOption
    />
  )
}

/**
 * JWT-based org switcher: reads available_orgs from token,
 * calls switch-org API to get new tokens.
 */
function JwtOrgSwitcher() {
  const { activeOrg, availableOrgs, switchOrg, isSwitching, hasMultipleOrgs } = useOrgSwitcher()

  // Don't render if user has only one org or no orgs
  if (!hasMultipleOrgs) return null

  return (
    <OrgSwitcherMenu
      activeOrgId={activeOrg?.id ?? null}
      activeOrgName={activeOrg?.name ?? 'Организация'}
      organizations={availableOrgs}
      onSelect={switchOrg}
      isSwitching={isSwitching}
    />
  )
}

/**
 * Shared UI component for the org menu.
 */
function OrgSwitcherMenu({
  activeOrgId,
  activeOrgName,
  organizations,
  onSelect,
  isSwitching,
  showAllOption,
}: {
  activeOrgId: number | null
  activeOrgName: string
  organizations: Array<{ id: number; name: string; slug: string }>
  onSelect: (orgId: number) => void
  isSwitching: boolean
  showAllOption?: boolean
}) {
  return (
    <Menu shadow="md" width={260} position="bottom-end">
      <Menu.Target>
        <Tooltip label="Переключить организацию" position="bottom">
          <UnstyledButton className={styles.switcherButton} disabled={isSwitching}>
            <Group gap={8} wrap="nowrap">
              <Avatar
                size={24}
                radius="sm"
                color="cyan"
                variant="light"
              >
                {isSwitching ? (
                  <Loader size={12} color="cyan" />
                ) : (
                  <IconBuilding size={14} />
                )}
              </Avatar>
              <Text size="sm" fw={500} c="gray.2" lineClamp={1} maw={140}>
                {activeOrgName}
              </Text>
              <IconSelector size={14} color="var(--mantine-color-gray-5)" />
            </Group>
          </UnstyledButton>
        </Tooltip>
      </Menu.Target>

      <Menu.Dropdown bg="var(--card-bg)" className="dropdownSurface">
        <Menu.Label c="dimmed">Организация</Menu.Label>

        {showAllOption && (
          <Menu.Item
            leftSection={<IconBuilding size={16} />}
            rightSection={activeOrgId === null ? <IconCheck size={14} color="var(--eco-content)" /> : null}
            onClick={() => {
              // For platform owner "all" mode, we pass 0 as signal
              // but the parent handles clearing
              if (activeOrgId !== null) {
                onSelect(activeOrgId) // toggle off = clear
              }
            }}
            className={activeOrgId === null ? styles.activeItem : undefined}
          >
            Все организации
          </Menu.Item>
        )}

        {organizations.map((org) => (
          <Menu.Item
            key={org.id}
            leftSection={
              <Avatar size={20} radius="sm" color="cyan" variant="light">
                {org.name.charAt(0).toUpperCase()}
              </Avatar>
            }
            rightSection={
              org.id === activeOrgId ? (
                <IconCheck size={14} color="var(--eco-content)" />
              ) : null
            }
            onClick={() => onSelect(org.id)}
            className={org.id === activeOrgId ? styles.activeItem : undefined}
            disabled={isSwitching}
          >
            <Text size="sm" lineClamp={1}>
              {org.name}
            </Text>
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  )
}
