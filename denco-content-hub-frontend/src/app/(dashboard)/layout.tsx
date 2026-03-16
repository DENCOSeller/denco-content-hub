'use client'

import { useEffect, useCallback } from 'react'
import {
  AppShell,
  Burger,
  Divider,
  Drawer,
  Group,
  NavLink,
  Text,
  Menu,
  UnstyledButton,
  Avatar,
  Stack,
  ActionIcon,
  Tooltip,
} from '@mantine/core'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import {
  IconHome,
  IconLogout,
  IconChevronDown,
  IconSettings,
  IconSearch,
  IconBuilding,
  IconLayoutDashboard,
  IconArrowLeft,
  IconShare,
  IconSparkles,
  IconBooks,
} from '@tabler/icons-react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

import { useAuthStore } from '@/stores/auth-store'
import { useLogoutMutation, useMeQuery } from '@/api/hooks/useAuth'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useCompanyStore } from '@/stores/company-store'
import { CompanySwitcher } from '@/components/features/company/CompanySwitcher'
import { useAiPanelStore } from '@/stores/ai-panel-store'
import { AiAssistantPanel } from '@/components/ai/AiAssistantPanel'
import { AiPageContextProvider } from '@/contexts/AiPageContext'
import styles from './dashboard.module.css'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [opened, { toggle }] = useDisclosure()
  const pathname = usePathname()
  const router = useRouter()
  const isMobile = useMediaQuery('(max-width: 62em)')

  const user = useAuthStore((s) => s.user)
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)
  const logout = useLogoutMutation()

  const aiPanelOpen = useAiPanelStore((s) => s.isOpen)
  const toggleAiPanel = useAiPanelStore((s) => s.toggle)
  const closeAiPanel = useAiPanelStore((s) => s.close)

  // Hydrate persisted store on mount
  useEffect(() => {
    useAiPanelStore.persist.rehydrate()
  }, [])

  // Keyboard shortcuts: Cmd/Ctrl+Shift+I toggle, Escape close
  const handleGlobalKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'i') {
        e.preventDefault()
        toggleAiPanel()
        return
      }
      if (e.key === 'Escape' && aiPanelOpen) {
        const activeEl = document.activeElement
        const isInInput =
          activeEl instanceof HTMLTextAreaElement ||
          activeEl instanceof HTMLInputElement ||
          activeEl?.closest('[contenteditable="true"]')
        if (!isInInput) {
          closeAiPanel()
        }
      }
    },
    [toggleAiPanel, closeAiPanel, aiPanelOpen],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [handleGlobalKeyDown])

  // Подгружаем user если его ещё нет (после reload)
  useMeQuery()

  const activeCompany = useCompanyStore((s) => s.activeCompany)

  // Определяем контекст: внутри воркспейса или компании
  const workspaceMatch = pathname.match(/^\/workspaces\/(\d+)/)
  const isInWorkspace = !!workspaceMatch
  const workspaceId = workspaceMatch ? Number(workspaceMatch[1]) : null

  const companyMatch = pathname.match(/^\/companies\/(\d+)/)
  const isInCompany = !!companyMatch
  const companyId = companyMatch ? Number(companyMatch[1]) : null

  // Общая навигация (вне воркспейса и компании)
  const generalLinks = [
    { href: '/dashboard', label: 'Главная', icon: IconHome },
    ...(user?.is_platform_owner
      ? [{ href: '/companies', label: 'Компании', icon: IconBuilding }]
      : []),
  ]

  // Навигация внутри воркспейса
  const workspaceLinks = workspaceId
    ? [
        { href: `/workspaces/${workspaceId}`, label: 'Обзор', icon: IconLayoutDashboard, exact: true },
        { href: `/workspaces/${workspaceId}/references`, label: 'Референсы', icon: IconSearch, exact: false },
        { href: `/workspaces/${workspaceId}/library`, label: 'Библиотека', icon: IconBooks, exact: false },
        { href: `/workspaces/${workspaceId}/settings`, label: 'Настройки', icon: IconSettings, exact: false },
      ]
    : []

  // Навигация внутри компании
  const companyLinks = companyId
    ? [
        { href: `/companies/${companyId}/knowledge`, label: 'Граф знаний', icon: IconShare, exact: false },
      ]
    : []

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        router.push('/login')
      },
    })
  }

  return (
    <AiPageContextProvider>
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 260,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      aside={{
        width: 380,
        breakpoint: 'md',
        collapsed: { desktop: !aiPanelOpen, mobile: true },
      }}
      padding="md"
    >
      <AppShell.Header className={styles.header}>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
              color="gray.4"
            />
            <Link href="/dashboard" className={styles.logo}>
              <Image
                src="/logo-denco.svg"
                alt="DENCO"
                height={28}
                width={140}
                style={{ objectFit: 'contain' }}
              />
              <Text className={styles.headerSubtitle}>Content Hub</Text>
            </Link>
          </Group>

          <Group gap="md">
            {user?.is_platform_owner && <CompanySwitcher />}

            <Tooltip label="AI Ассистент" position="bottom">
              <ActionIcon
                variant={aiPanelOpen ? 'light' : 'subtle'}
                size="lg"
                color="neonBlue"
                onClick={toggleAiPanel}
                aria-label="Toggle AI панель"
                className={styles.aiToggle}
              >
                <IconSparkles size={20} />
              </ActionIcon>
            </Tooltip>

            <Menu shadow="md" width={200}>
            <Menu.Target>
              <UnstyledButton className={styles.userButton}>
                <Group gap="xs">
                  <Avatar
                    size="sm"
                    radius="xl"
                    variant="gradient"
                    gradient={{ from: 'neonBlue', to: 'neonViolet', deg: 135 }}
                  >
                    {user?.name?.charAt(0).toUpperCase() ?? '?'}
                  </Avatar>
                  <Text size="sm" fw={500} c="gray.2" visibleFrom="sm">
                    {user?.name ?? 'Пользователь'}
                  </Text>
                  <IconChevronDown size={14} color="var(--mantine-color-gray-5)" />
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown bg="var(--card-bg)" style={{ border: '1px solid var(--border-subtle)' }}>
              <Menu.Item
                color="red"
                leftSection={<IconLogout size={16} />}
                onClick={handleLogout}
              >
                Выйти
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar className={styles.navbar} p="md">
        {isInWorkspace ? (
          <Stack gap={4}>
            <NavLink
              component={Link}
              href="/dashboard"
              label="Все воркспейсы"
              leftSection={
                <IconArrowLeft size={18} style={{ color: 'var(--neon-blue)' }} />
              }
              className={styles.navLink}
              color="neonBlue"
              variant="subtle"
            />
            <Divider my="xs" color="var(--border-subtle)" />
            <Text className={styles.navSection} mb={6}>
              {activeWorkspace?.name ?? 'Воркспейс'}
            </Text>
            {workspaceLinks.map((link) => (
              <NavLink
                key={link.href}
                component={Link}
                href={link.href}
                label={link.label}
                leftSection={
                  <link.icon size={20} style={{ color: 'var(--neon-blue)' }} />
                }
                active={
                  link.exact
                    ? pathname === link.href
                    : pathname.startsWith(link.href)
                }
                className={styles.navLink}
                color="neonBlue"
                variant="light"
              />
            ))}
          </Stack>
        ) : isInCompany ? (
          <Stack gap={4}>
            <NavLink
              component={Link}
              href="/companies"
              label="Все компании"
              leftSection={
                <IconArrowLeft size={18} style={{ color: 'var(--neon-blue)' }} />
              }
              className={styles.navLink}
              color="neonBlue"
              variant="subtle"
            />
            <Divider my="xs" color="var(--border-subtle)" />
            <Text className={styles.navSection} mb={6}>
              {activeCompany?.name ?? 'Компания'}
            </Text>
            {companyLinks.map((link) => (
              <NavLink
                key={link.href}
                component={Link}
                href={link.href}
                label={link.label}
                leftSection={
                  <link.icon size={20} style={{ color: 'var(--neon-blue)' }} />
                }
                active={
                  link.exact
                    ? pathname === link.href
                    : pathname.startsWith(link.href)
                }
                className={styles.navLink}
                color="neonBlue"
                variant="light"
              />
            ))}
          </Stack>
        ) : (
          <Stack gap={4}>
            <Text className={styles.navSection} mb={6}>
              Навигация
            </Text>
            {generalLinks.map((link) => (
              <NavLink
                key={link.href}
                component={Link}
                href={link.href}
                label={link.label}
                leftSection={
                  <link.icon size={20} style={{ color: 'var(--neon-blue)' }} />
                }
                active={pathname === link.href}
                className={styles.navLink}
                color="neonBlue"
                variant="light"
              />
            ))}
          </Stack>
        )}
      </AppShell.Navbar>

      {!isMobile && aiPanelOpen && (
        <AppShell.Aside className={styles.aside}>
          <AiAssistantPanel />
        </AppShell.Aside>
      )}

      <AppShell.Main className={styles.main}>{children}</AppShell.Main>

      {isMobile && !aiPanelOpen && (
        <button
          type="button"
          className={styles.aiFab}
          onClick={toggleAiPanel}
          aria-label="Открыть AI ассистент"
        >
          <IconSparkles size={22} />
        </button>
      )}

      {isMobile && (
        <Drawer
          opened={aiPanelOpen}
          onClose={closeAiPanel}
          position="right"
          size="100%"
          withCloseButton={false}
          styles={{
            body: { padding: 0, height: '100%' },
            content: { background: 'rgba(10, 10, 15, 0.95)' },
          }}
        >
          <AiAssistantPanel />
        </Drawer>
      )}
    </AppShell>
    </AiPageContextProvider>
  )
}
