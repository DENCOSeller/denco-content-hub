import type { Platform, ContentType, Category, LibrarySourceType } from '@/api/client/types.gen'

export interface SettingsLabels {
  speaker: string | null
  contentGoal: string | null
  narrative: string | null
  hookType: string | null
  tone: string | null
  product: string | null
}

export interface WizardState {
  title: string
  platform: Platform | null
  contentType: ContentType | (string & {}) | null
  category: Category | null
  sourceType: LibrarySourceType | null
  sourceReferenceId: number | null
  sourceNodeIds: number[]
  sourceText: string
  ideaText: string
  huntLevel: number | null
  speakerNodeId: number | null
  contentGoalNodeId: number | null
  narrativeNodeId: number | null
  hookTypeNodeId: number | null
  toneNodeId: number | null
  productNodeId: number | null
  settingsLabels: SettingsLabels
}

export const INITIAL_SETTINGS_LABELS: SettingsLabels = {
  speaker: null,
  contentGoal: null,
  narrative: null,
  hookType: null,
  tone: null,
  product: null,
}

export const INITIAL_WIZARD_STATE: WizardState = {
  title: '',
  platform: null,
  contentType: null,
  category: null,
  sourceType: null,
  sourceReferenceId: null,
  sourceNodeIds: [],
  sourceText: '',
  ideaText: '',
  huntLevel: null,
  speakerNodeId: null,
  contentGoalNodeId: null,
  narrativeNodeId: null,
  hookTypeNodeId: null,
  toneNodeId: null,
  productNodeId: null,
  settingsLabels: INITIAL_SETTINGS_LABELS,
}

export const PLATFORM_CONTENT_TYPES: Record<Platform, { value: string; label: string }[]> = {
  youtube: [
    { value: 'long_video', label: 'Видео' },
    { value: 'shorts', label: 'Shorts' },
    { value: 'stream', label: 'Стрим' },
  ],
  instagram: [
    { value: 'reels', label: 'Reels' },
    { value: 'post', label: 'Пост' },
    { value: 'carousel', label: 'Карусель' },
    { value: 'stories', label: 'Stories' },
  ],
  telegram: [
    { value: 'post', label: 'Пост' },
    { value: 'long_video', label: 'Видео' },
    { value: 'podcast', label: 'Подкаст' },
  ],
  vk: [
    { value: 'post', label: 'Пост' },
    { value: 'long_video', label: 'Видео' },
    { value: 'clip', label: 'Клип' },
    { value: 'article', label: 'Статья' },
  ],
}

export const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: 'reach', label: 'Охватное' },
  { value: 'expert', label: 'Экспертное' },
  { value: 'selling', label: 'Продающее' },
  { value: 'warming', label: 'Прогревающее' },
]

export const PLATFORM_LABELS: Record<Platform, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  telegram: 'Telegram',
  vk: 'VK',
}

export const CONTENT_TYPE_LABELS: Record<string, string> = {
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

export const CATEGORY_LABELS: Record<Category, string> = {
  reach: 'Охватное',
  expert: 'Экспертное',
  selling: 'Продающее',
  warming: 'Прогревающее',
}

export const SOURCE_TYPE_LABELS: Record<LibrarySourceType, string> = {
  reference: 'Из Референсов',
  knowledge: 'Из Графа знаний',
  manual: 'Вручную',
  mixed: 'Смешанный',
}

export const HUNT_LEVEL_OPTIONS = [
  { value: '1', label: '1 — Не осознаёт проблему' },
  { value: '2', label: '2 — Осознаёт проблему' },
  { value: '3', label: '3 — Ищет решение' },
  { value: '4', label: '4 — Сравнивает варианты' },
  { value: '5', label: '5 — Готов купить' },
]
