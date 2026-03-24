'use client'

import { useState, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Group,
  Stack,
  Text,
  ActionIcon,
  Badge,
  Tabs,
  Button,
  Loader,
  Divider,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconArrowLeft,
  IconBrandYoutube,
  IconBrandInstagram,
  IconBrandTelegram,
  IconWorld,
  IconSparkles,
  IconDeviceFloppy,
  IconEdit,
  IconRefresh,
  IconCalendarPlus,
} from '@tabler/icons-react'

import {
  useLibraryItemQuery,
  useUpdateLibraryItemMutation,
  useGenerateLibraryContentMutation,
} from '@/api/hooks/useLibrary'
// LibraryStatus = 'draft' | 'ready' | 'published'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { AppBreadcrumbs } from '@/components/shared/Breadcrumbs'
import { ContentBlocksView } from '@/components/features/library/ContentBlocksView'
import { ContentBlocksEdit } from '@/components/features/library/ContentBlocksEdit'
import { ContentBlockAiPanel } from '@/components/features/library/ContentBlockAiPanel'
import type { BlockInfo } from '@/components/features/library/ContentBlockAiPanel'
import { AddToPlanModal } from '@/components/features/content-plan/AddToPlanModal'

import styles from './library-item.module.css'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORM_CONFIG: Record<string, { icon: typeof IconBrandYoutube; color: string; label: string }> = {
  youtube: { icon: IconBrandYoutube, color: '#FF0000', label: 'YouTube' },
  instagram: { icon: IconBrandInstagram, color: '#E1306C', label: 'Instagram' },
  telegram: { icon: IconBrandTelegram, color: '#0088cc', label: 'Telegram' },
  vk: { icon: IconWorld, color: '#4C75A3', label: 'VK' },
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  long_video: 'Видео',
  shorts: 'Shorts',
  reels: 'Reels',
  post: 'Пост',
  carousel: 'Карусель',
  article: 'Статья',
  clip: 'Клип',
  stream: 'Стрим',
  stories: 'Stories',
  podcast: 'Подкаст',
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  reach: { label: 'Охватное', color: 'blue' },
  expert: { label: 'Экспертное', color: 'violet' },
  selling: { label: 'Продающее', color: 'green' },
  warming: { label: 'Прогревающее', color: 'orange' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Черновик', color: 'gray' },
  ready: { label: 'Готов', color: 'green' },
  published: { label: 'Опубликован', color: 'blue' },
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  reference: 'Из Референсов',
  knowledge: 'Из Графа знаний',
  manual: 'Вручную',
  mixed: 'Смешанный',
}

const HUNT_LEVEL_LABELS: Record<number, string> = {
  1: '1 — Не осознаёт проблему',
  2: '2 — Осознаёт проблему',
  3: '3 — Ищет решение',
  4: '4 — Сравнивает варианты',
  5: '5 — Готов купить',
}

// ---------------------------------------------------------------------------
// Content rendering helper (used in Params tab)
// ---------------------------------------------------------------------------

function ContentBlockDisplay({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.contentBlock}>
      <div className={styles.contentBlockLabel}>{label}</div>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function LibraryItemDetailPage() {
  const params = useParams()
  const router = useRouter()

  const workspaceId = Number(params.id)
  const itemId = Number(params.itemId)
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)

  const {
    data: item,
    isLoading,
    isError,
    refetch,
  } = useLibraryItemQuery(workspaceId, itemId)

  const updateMutation = useUpdateLibraryItemMutation(workspaceId)
  const generateMutation = useGenerateLibraryContentMutation(workspaceId)

  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState<Record<string, unknown>>({})

  // Plan modal state
  const [planModalOpen, setPlanModalOpen] = useState(false)

  // AI panel state
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [aiBlock, setAiBlock] = useState<BlockInfo | null>(null)

  const handleAiImprove = useCallback(
    (fieldName: string, fieldLabel: string, fieldValue: string) => {
      setAiBlock({ fieldName, fieldLabel, fieldValue })
      setAiPanelOpen(true)
    },
    [],
  )

  // Current content: prefer edited_content over generated_content
  const currentContent = useMemo(() => {
    if (!item) return null
    return (item.edited_content ?? item.generated_content ?? null) as Record<string, unknown> | null
  }, [item])

  const hasContent = currentContent && Object.keys(currentContent).length > 0

  // Start editing
  function handleStartEdit() {
    if (!currentContent) return
    setEditedContent(structuredClone(currentContent))
    setIsEditing(true)
  }

  // Save edited content
  function handleSave() {
    updateMutation.mutate(
      {
        itemId,
        data: { edited_content: editedContent },
      },
      {
        onSuccess: () => {
          setIsEditing(false)
          notifications.show({ title: 'Сохранено', message: 'Изменения сохранены', color: 'green' })
        },
        onError: () => {
          notifications.show({ title: 'Ошибка', message: 'Не удалось сохранить', color: 'red' })
        },
      },
    )
  }

  // Regenerate
  function handleRegenerate() {
    generateMutation.mutate(itemId, {
      onSuccess: () => {
        setIsEditing(false)
        notifications.show({ title: 'Генерация запущена', message: 'Контент генерируется заново', color: 'blue' })
      },
      onError: () => {
        notifications.show({ title: 'Ошибка', message: 'Не удалось запустить генерацию', color: 'red' })
      },
    })
  }

  const baseBreadcrumbs = [
    { label: activeWorkspace?.company_name ?? '' },
    { label: activeWorkspace?.name ?? '', href: `/workspaces/${workspaceId}` },
    { label: 'Библиотека', href: `/workspaces/${workspaceId}/library` },
  ]

  if (isLoading) return (
    <Stack gap="md">
      <AppBreadcrumbs items={[...baseBreadcrumbs, { label: '...' }]} />
      <LoadingState message="Загрузка контента..." />
    </Stack>
  )
  if (isError || !item) {
    return (
      <Stack gap="md">
        <AppBreadcrumbs items={[...baseBreadcrumbs, { label: 'Ошибка' }]} />
        <ErrorState message="Не удалось загрузить элемент библиотеки" onRetry={refetch} />
      </Stack>
    )
  }

  const platform = PLATFORM_CONFIG[item.platform] ?? PLATFORM_CONFIG.vk
  const PlatformIcon = platform.icon
  const contentTypeLabel = CONTENT_TYPE_LABELS[item.content_type] ?? item.content_type
  const category = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.reach
  const status = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.draft
  const sourceLabel = SOURCE_TYPE_LABELS[item.source_type] ?? item.source_type
  const huntLabel = HUNT_LEVEL_LABELS[item.hunt_level] ?? `${item.hunt_level}`
  const isGenerating = generateMutation.isPending

  const breadcrumbs = [
    ...baseBreadcrumbs,
    { label: item.title ?? 'Без названия' },
  ]

  return (
    <>
      <AppBreadcrumbs items={breadcrumbs} />

      <div className={styles.layout}>
        {/* ── LEFT COLUMN — Meta ── */}
        <div className={styles.leftCol}>
          <Stack gap="md">
            <Group gap="xs">
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => router.push(`/workspaces/${workspaceId}/library`)}
                aria-label="Назад"
              >
                <IconArrowLeft size={18} />
              </ActionIcon>
              <Text size="sm" c="dimmed">Назад к библиотеке</Text>
            </Group>

            {/* Title */}
            <Text fw={600} size="lg" lineClamp={3}>
              {item.title ?? 'Без названия'}
            </Text>

            {/* Status + Actions */}
            <Group gap="xs">
              <Badge
                variant="light"
                color={status.color}
                size="md"
                leftSection={isGenerating ? <Loader size={10} color={status.color} /> : undefined}
              >
                {isGenerating ? 'Генерация...' : status.label}
              </Badge>
            </Group>

            <Button
              variant="light"
              size="xs"
              leftSection={<IconCalendarPlus size={14} />}
              onClick={() => setPlanModalOpen(true)}
            >
              В план
            </Button>

            <Divider color="var(--border-subtle)" />

            {/* Meta info */}
            <div className={styles.metaBlock}>
              <Stack gap={0}>
                {/* Platform */}
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Платформа</span>
                  <Group gap="xs">
                    <div className={styles.platformIcon} style={{ background: `${platform.color}20` }}>
                      <PlatformIcon size={18} style={{ color: platform.color }} />
                    </div>
                    <span className={styles.metaValue}>{platform.label}</span>
                  </Group>
                </div>

                {/* Content type */}
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Тип</span>
                  <span className={styles.metaValue}>{contentTypeLabel}</span>
                </div>

                {/* Category */}
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Категория</span>
                  <Badge variant="light" color={category.color} size="sm">{category.label}</Badge>
                </div>

                {/* Hunt level */}
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Уровень</span>
                  <Badge variant="outline" color="gray" size="sm">Hunt {item.hunt_level}</Badge>
                </div>

                {/* Source */}
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Источник</span>
                  <span className={styles.metaValue}>{sourceLabel}</span>
                </div>

                {/* Source text / Idea */}
                {item.source_text && (
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Замысел</span>
                    <span className={styles.metaValue}>{item.source_text}</span>
                  </div>
                )}

                {/* Created */}
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Создан</span>
                  <span className={styles.metaValue}>
                    {new Date(item.created_at).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                {/* Updated */}
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Обновлён</span>
                  <span className={styles.metaValue}>
                    {new Date(item.updated_at).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </Stack>
            </div>
          </Stack>
        </div>

        {/* ── RIGHT COLUMN — Tabs ── */}
        <div className={styles.rightCol}>
          <Tabs defaultValue="generated" keepMounted={false} className={styles.tabsRoot}>
            <Tabs.List className={styles.tabsList}>
              <Tabs.Tab value="generated">Сгенерировано</Tabs.Tab>
              <Tabs.Tab value="params">Параметры</Tabs.Tab>
              <Tabs.Tab value="history">История</Tabs.Tab>
            </Tabs.List>

            {/* ── Tab: Generated content ── */}
            <Tabs.Panel value="generated" className={styles.tabPanel}>
              {/* Action bar */}
              <Group gap="sm" mb="md">
                {hasContent && !isEditing && (
                  <Button
                    variant="light"
                    size="xs"
                    leftSection={<IconEdit size={14} />}
                    onClick={handleStartEdit}
                  >
                    Редактировать
                  </Button>
                )}
                {isEditing && (
                  <>
                    <Button
                      variant="filled"
                      size="xs"
                      leftSection={<IconDeviceFloppy size={14} />}
                      onClick={handleSave}
                      loading={updateMutation.isPending}
                    >
                      Сохранить
                    </Button>
                    <Button
                      variant="subtle"
                      size="xs"
                      color="gray"
                      onClick={() => setIsEditing(false)}
                    >
                      Отмена
                    </Button>
                  </>
                )}
                <Button
                  variant="light"
                  color="violet"
                  size="xs"
                  leftSection={<IconRefresh size={14} />}
                  onClick={handleRegenerate}
                  loading={generateMutation.isPending}
                  disabled={isGenerating}
                >
                  Регенерировать
                </Button>
              </Group>

              {/* Content display */}
              <div className={styles.contentArea}>
                {isGenerating && (
                  <div className={styles.emptyContent}>
                    <Loader size="lg" />
                    <Text size="sm" c="dimmed">Контент генерируется...</Text>
                    <Text size="xs" c="dimmed">Это может занять несколько минут</Text>
                  </div>
                )}

                {!isGenerating && !hasContent && (
                  <div className={styles.emptyContent}>
                    <IconSparkles size={48} style={{ opacity: 0.3 }} />
                    <Text size="sm" c="dimmed">Контент ещё не сгенерирован</Text>
                    <Button
                      variant="light"
                      color="violet"
                      size="sm"
                      leftSection={<IconSparkles size={14} />}
                      onClick={handleRegenerate}
                      loading={generateMutation.isPending}
                    >
                      Сгенерировать
                    </Button>
                  </div>
                )}

                {!isGenerating && hasContent && !isEditing && (
                  <ContentBlocksView
                    content={currentContent!}
                    contentType={item.content_type}
                    onAiImprove={handleAiImprove}
                  />
                )}

                {isEditing && (
                  <ContentBlocksEdit
                    content={editedContent}
                    onChange={setEditedContent}
                  />
                )}
              </div>
            </Tabs.Panel>

            {/* ── Tab: Parameters ── */}
            <Tabs.Panel value="params" className={styles.tabPanel}>
              <div className={styles.contentArea}>
                <div className={styles.metaBlock}>
                  <Stack gap={0}>
                    <div className={styles.metaRow}>
                      <span className={styles.metaLabel}>Платформа</span>
                      <span className={styles.metaValue}>{platform.label}</span>
                    </div>
                    <div className={styles.metaRow}>
                      <span className={styles.metaLabel}>Тип контента</span>
                      <span className={styles.metaValue}>{contentTypeLabel}</span>
                    </div>
                    <div className={styles.metaRow}>
                      <span className={styles.metaLabel}>Категория</span>
                      <Badge variant="light" color={category.color} size="sm">{category.label}</Badge>
                    </div>
                    <div className={styles.metaRow}>
                      <span className={styles.metaLabel}>Hunt Level</span>
                      <span className={styles.metaValue}>{huntLabel}</span>
                    </div>
                    <div className={styles.metaRow}>
                      <span className={styles.metaLabel}>Источник</span>
                      <span className={styles.metaValue}>{sourceLabel}</span>
                    </div>
                    {item.source_text && (
                      <div className={styles.metaRow}>
                        <span className={styles.metaLabel}>Текст источника</span>
                        <span className={styles.metaValue}>{item.source_text}</span>
                      </div>
                    )}
                  </Stack>
                </div>

                {item.generation_prompt && (
                  <ContentBlockDisplay label="Промпт генерации">
                    <div className={styles.contentBlockText} style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {item.generation_prompt}
                    </div>
                  </ContentBlockDisplay>
                )}
              </div>
            </Tabs.Panel>

            {/* ── Tab: History ── */}
            <Tabs.Panel value="history" className={styles.tabPanel}>
              <div className={styles.contentArea}>
                <div className={styles.emptyContent}>
                  <Text size="sm" c="dimmed">
                    История генераций будет доступна позже
                  </Text>
                </div>
              </div>
            </Tabs.Panel>
          </Tabs>
        </div>
      </div>

      {/* Add to Plan Modal */}
      <AddToPlanModal
        opened={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        workspaceId={workspaceId}
        preselectedItem={{
          id: item.id,
          label: item.title ?? `#${item.id} (${item.platform})`,
        }}
      />

      {/* AI Improve Drawer */}
      <ContentBlockAiPanel
        opened={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
        block={aiBlock}
        workspaceId={workspaceId}
        itemId={itemId}
        contentType={item.content_type}
        platform={item.platform}
        allContent={currentContent ?? {}}
      />
    </>
  )
}
