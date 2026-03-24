'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  AppShell,
  Box,
  Burger,
  Divider,
  Drawer,
  Group,
  NavLink,
  Text,
  Menu,
  UnstyledButton,
  Avatar,
  ActionIcon,
  Tooltip,
} from '@mantine/core'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import {
  IconHome,
  IconLogout,
  IconChevronDown,
  IconChevronRight,
  IconSettings,
  IconSearch,
  IconBuilding,
  IconArrowLeft,
  IconShare,
  IconSparkles,
  IconBooks,
  IconCalendar,
  IconList,
  IconSpy,
  IconFlame,
  IconChevronsLeft,
  IconChevronsRight,
  IconUsers,
  IconShield,
  IconHistory,
  IconFlask,
  IconLibrary,
  IconCalendarEvent,
} from '@tabler/icons-react'
import { usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

import { useAuthStore } from '@/stores/auth-store'
import { useSsoLogout, useMeQuery } from '@/api/hooks/useAuth'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useOrganizationStore } from '@/stores/organization-store'
import { OrganizationSwitcher } from '@/components/features/organization/OrganizationSwitcher'
import { OrgMismatchNotification } from '@/components/features/organization/OrgMismatchNotification'
import { useAiPanelStore } from '@/stores/ai-panel-store'
import { NotificationBell } from '@/components/features/competitors/NotificationBell'
import { AiAssistantPanel } from '@/components/ai/AiAssistantPanel'
import { AiPageContextProvider } from '@/contexts/AiPageContext'
import styles from './dashboard.module.css'

const SIDEBAR_COLLAPSED_KEY = 'denco-ch-sidebar-collapsed'
const COLLAPSED_SECTIONS_KEY = 'denco-ch-collapsed-sections'

export function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const [opened, { toggle }] = useDisclosure()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentUrl = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const mobileQuery = useMediaQuery('(max-width: 62em)')
  const isMobile = mounted ? mobileQuery : false

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
      if (stored === 'true') setSidebarCollapsed(true)
    } catch { /* ignore */ }
    try {
      const storedSections = localStorage.getItem(COLLAPSED_SECTIONS_KEY)
      if (storedSections) {
        const parsed = JSON.parse(storedSections)
        if (Array.isArray(parsed)) {
          setCollapsedSections(new Set(parsed))
        }
      }
    } catch { /* ignore */ }
  }, [])

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  const toggleSection = useCallback((section: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      try {
        localStorage.setItem(COLLAPSED_SECTIONS_KEY, JSON.stringify([...next]))
      } catch { /* ignore */ }
      return next
    })
  }, [])

  // Keyboard shortcut Cmd+\ / Ctrl+\
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleSidebar])

  const user = useAuthStore((s) => s.user)
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)
  const handleSsoLogout = useSsoLogout()

  const aiPanelOpen = useAiPanelStore((s) => s.isOpen)
  const aiPanelWidth = useAiPanelStore((s) => s.panelWidth)
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

  const activeOrganization = useOrganizationStore((s) => s.activeOrganization)

  // Определяем контекст: внутри воркспейса или организации
  const workspaceMatch = pathname.match(/^\/workspaces\/(\d+)/)
  const isInWorkspace = !!workspaceMatch
  const workspaceId = workspaceMatch ? Number(workspaceMatch[1]) : null

  const organizationMatch = pathname.match(/^\/organizations\/(\d+)/)
  const isInOrganization = !!organizationMatch
  const organizationId = organizationMatch ? Number(organizationMatch[1]) : null

  // Общая навигация (вне воркспейса и организации)
  const generalLinks = [
    { href: '/dashboard', label: 'Главная', icon: IconHome },
    ...(user?.is_platform_owner
      ? [
          { href: '/organizations', label: 'Организации', icon: IconBuilding },
          { href: '/organizations/audit', label: 'Журнал действий', icon: IconHistory },
        ]
      : []),
  ]

  // Grouped workspace navigation sections
  const workspaceSections = workspaceId
    ? [
        {
          key: 'Исследование',
          icon: IconFlask,
          links: [
            { href: `/workspaces/${workspaceId}/references`, label: 'Референсы', icon: IconSearch, exact: false },
            { href: `/workspaces/${workspaceId}/competitors`, label: 'Мониторинг каналов', icon: IconSpy, exact: false },
            { href: `/workspaces/${workspaceId}/trends`, label: 'Тренды', icon: IconFlame, exact: false },
          ],
        },
        {
          key: 'Библиотека',
          icon: IconLibrary,
          links: [
            { href: `/workspaces/${workspaceId}/library`, label: 'Все материалы', icon: IconBooks, exact: false },
            { href: `/workspaces/${workspaceId}/knowledge`, label: 'Граф знаний', icon: IconShare, exact: false },
          ],
        },
        {
          key: 'Контент-план',
          icon: IconCalendarEvent,
          links: [
            { href: `/workspaces/${workspaceId}/content-plan`, label: 'Календарь', icon: IconCalendar, exact: false },
            { href: `/workspaces/${workspaceId}/content-plan?view=list`, label: 'Список', icon: IconList, exact: false },
          ],
        },
      ]
    : []

  // Settings link for footer
  const settingsLink = workspaceId
    ? { href: `/workspaces/${workspaceId}/settings`, label: 'Настройки', icon: IconSettings, exact: false }
    : null

  // Навигация внутри организации
  const organizationLinks = organizationId
    ? [
        { href: `/organizations/${organizationId}/knowledge`, label: 'Граф знаний', icon: IconShare, exact: false },
        { href: `/organizations/${organizationId}/teams`, label: 'Команды', icon: IconUsers, exact: false },
        { href: `/organizations/${organizationId}/roles`, label: 'Роли', icon: IconShield, exact: false },
        { href: `/organizations/${organizationId}/audit`, label: 'Журнал действий', icon: IconHistory, exact: false },
      ]
    : []

  const handleLogout = () => {
    handleSsoLogout()
  }

  const renderNavLink = (link: { href: string; label: string; icon: React.ElementType; exact?: boolean }, isActive: boolean) => {
    const navItem = (
      <NavLink
        key={link.href}
        component={Link}
        href={link.href}
        label={sidebarCollapsed ? '' : link.label}
        aria-label={sidebarCollapsed ? link.label : undefined}
        aria-current={isActive ? 'page' : undefined}
        leftSection={<link.icon size={18} className="iconEco" />}
        active={isActive}
        className={`${styles.navLink} ${sidebarCollapsed ? styles.navLinkCollapsed : ''}`}
        color="contentHubTeal"
        variant="light"
      />
    )
    return sidebarCollapsed ? (
      <Tooltip key={link.href} label={link.label} position="right" withArrow>
        {navItem}
      </Tooltip>
    ) : navItem
  }

  const renderSectionHeader = (sectionKey: string, SectionIcon?: React.ElementType) => {
    if (sidebarCollapsed) {
      return SectionIcon ? (
        <Tooltip label={sectionKey} position="right" withArrow>
          <div className={styles.sectionDividerCollapsed}>
            <SectionIcon size={14} className={styles.sectionIconCollapsed} />
          </div>
        </Tooltip>
      ) : (
        <Divider my={4} color="var(--border-subtle)" />
      )
    }
    return (
      <div
        className={styles.sectionHeader}
        onClick={() => toggleSection(sectionKey)}
        role="button"
        tabIndex={0}
        aria-expanded={!collapsedSections.has(sectionKey)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection(sectionKey) } }}
      >
        <span className={styles.sectionLabel}>{sectionKey}</span>
        <IconChevronRight
          size={12}
          className={`${styles.sectionChevron} ${!collapsedSections.has(sectionKey) ? styles.sectionChevronOpen : ''}`}
        />
      </div>
    )
  }

  return (
    <AiPageContextProvider>
    <AppShell
      header={{ height: 52 }}
      navbar={{
        width: sidebarCollapsed ? 60 : 240,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      aside={{
        width: aiPanelWidth,
        breakpoint: 'md',
        collapsed: { desktop: !aiPanelOpen, mobile: true },
      }}
      padding="md"
    >
      <AppShell.Header className={styles.header}>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
              color="gray.4"
            />
            <Link href="/dashboard" className={styles.headerBrand}>
              <Image
                src="/logo-denco.svg"
                alt="DENCO"
                height={20}
                width={100}
                className="objectContain"
              />
              <span className={styles.headerBrandSeparator}>/</span>
              <span className={styles.headerBrandProduct}>Content Hub</span>
            </Link>
          </Group>

          <Group gap="md">
            <OrganizationSwitcher />

            <NotificationBell />

            <Tooltip label="AI Ассистент" position="bottom">
              <ActionIcon
                variant={aiPanelOpen ? 'light' : 'subtle'}
                size="lg"
                color="contentHubTeal"
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
                    gradient={{ from: 'contentHubTeal', to: 'neonViolet', deg: 135 }}
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
            <Menu.Dropdown bg="var(--card-bg)" className="dropdownSurface">
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

      <AppShell.Navbar className={styles.navbar} data-collapsed={sidebarCollapsed} aria-label="Основная навигация">
        {/* === Sticky Top Zone: Collapse toggle === */}
        <div className={styles.sidebarTop}>
          <Group justify="flex-end" align="center" wrap="nowrap">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={toggleSidebar}
              className={styles.collapseBtn}
              title={sidebarCollapsed ? 'Развернуть (Ctrl+\\)' : 'Свернуть (Ctrl+\\)'}
              aria-label={sidebarCollapsed ? 'Развернуть боковую панель' : 'Свернуть боковую панель'}
              visibleFrom="sm"
            >
              {sidebarCollapsed ? <IconChevronsRight size={16} /> : <IconChevronsLeft size={16} />}
            </ActionIcon>
          </Group>
        </div>

        {/* === Scrollable Nav Zone === */}
        <div className={styles.sidebarNav}>
        {isInWorkspace ? (
          <>
            {renderNavLink(
              { href: '/dashboard', label: 'Все воркспейсы', icon: IconArrowLeft, exact: true },
              false
            )}
            <Divider my={4} color="var(--border-subtle)" />
            {sidebarCollapsed && activeWorkspace && (
              <Tooltip label={activeWorkspace.name} position="right" withArrow>
                <Avatar
                  size={28}
                  radius="xl"
                  color="contentHubTeal"
                  variant="light"
                  mx="auto"
                  mb={4}
                  className={styles.collapsedAvatar}
                >
                  {activeWorkspace.name.charAt(0).toUpperCase()}
                </Avatar>
              </Tooltip>
            )}

            {/* Grouped sections */}
            {workspaceSections.map((section) => (
              <div key={section.key}>
                {renderSectionHeader(section.key, section.icon)}
                {(sidebarCollapsed || !collapsedSections.has(section.key)) && section.links.map((link) => {
                  // Handle links with query params (e.g. content-plan?view=list)
                  const hasQuery = link.href.includes('?')
                  let isActive: boolean
                  if (hasQuery) {
                    // Exact match including query string
                    isActive = currentUrl === link.href
                  } else if (link.exact) {
                    isActive = pathname === link.href
                  } else {
                    // For content-plan without query: active only when no ?view= param
                    const isContentPlan = link.href.endsWith('/content-plan')
                    if (isContentPlan) {
                      isActive = pathname.startsWith(link.href) && !searchParams.has('view')
                    } else {
                      isActive = pathname.startsWith(link.href)
                    }
                  }
                  return renderNavLink(link, isActive)
                })}
              </div>
            ))}
          </>
        ) : isInOrganization ? (
          <>
            {renderNavLink(
              { href: '/organizations', label: 'Все организации', icon: IconArrowLeft, exact: true },
              false
            )}
            <Divider my={4} color="var(--border-subtle)" />
            {!sidebarCollapsed && (
              <Text className={styles.navSection}>
                {activeOrganization?.name ?? 'Организация'}
              </Text>
            )}
            {organizationLinks.map((link) =>
              renderNavLink(
                link,
                link.exact ? pathname === link.href : pathname.startsWith(link.href)
              )
            )}
          </>
        ) : (
          <>
            {!sidebarCollapsed && (
              <Text className={styles.navSection}>
                Навигация
              </Text>
            )}
            {generalLinks.map((link) =>
              renderNavLink(link, pathname === link.href)
            )}
          </>
        )}
        </div>

        {/* === Sticky Bottom Zone: Settings + User === */}
        {isInWorkspace && (
          <div className={styles.sidebarBottom}>
            {settingsLink && renderNavLink(
              settingsLink,
              pathname.startsWith(settingsLink.href)
            )}

            <Divider my="xs" color="var(--border-subtle)" />

            {sidebarCollapsed ? (
              <div className={styles.userSectionCollapsed}>
                <Tooltip label={user?.name ?? 'Пользователь'} position="right" withArrow>
                  <Avatar
                    size={28}
                    radius="xl"
                    variant="gradient"
                    gradient={{ from: 'contentHubTeal', to: 'neonViolet', deg: 135 }}
                  >
                    {user?.name?.charAt(0).toUpperCase() ?? '?'}
                  </Avatar>
                </Tooltip>
                <Tooltip label="Выйти" position="right" withArrow>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    onClick={handleLogout}
                  >
                    <IconLogout size={16} />
                  </ActionIcon>
                </Tooltip>
              </div>
            ) : (
              <Group gap="xs" className={styles.userSection}>
                <Avatar
                  size={24}
                  radius="xl"
                  variant="gradient"
                  gradient={{ from: 'contentHubTeal', to: 'neonViolet', deg: 135 }}
                >
                  {user?.name?.charAt(0).toUpperCase() ?? '?'}
                </Avatar>
                <Box className={styles.userInfoBox}>
                  <Text size="sm" fw={500} c="gray.2" truncate>
                    {user?.name ?? 'Пользователь'}
                  </Text>
                </Box>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  onClick={handleLogout}
                  title="Выйти"
                >
                  <IconLogout size={16} />
                </ActionIcon>
              </Group>
            )}
          </div>
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
      <OrgMismatchNotification />
    </AppShell>
    </AiPageContextProvider>
  )
}
