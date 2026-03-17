import {
  IconTarget,
  IconBulb,
  IconSpeakerphone,
  IconArrowsSort,
  IconUsers,
  IconSearch,
  IconBrandNotion,
  IconNote,
  IconMicrophone2,
  IconFocus2,
  IconMovie,
  IconFishHook,
  IconBox,
  IconMoodSmile,
  IconDeviceTv,
  IconLayoutGrid,
  IconStairs,
  IconUsersGroup,
  IconQuestionMark,
} from '@tabler/icons-react'

import type { KgNodeTypeDefResponse } from '@/api/client/types.gen'

export type NodeType =
  | 'target_audience'
  | 'meaning'
  | 'channel'
  | 'funnel'
  | 'competitor'
  | 'seo'
  | 'brand'
  | 'note'
  | 'speaker'
  | 'content_goal'
  | 'narrative_format'
  | 'hook_type'
  | 'product_focus'
  | 'tone_of_voice'
  | 'platform'
  | 'content_format'
  | 'hunt_level'
  | 'audience_segment'

export type TablerIcon = typeof IconTarget

export interface NodeTypeConfig {
  label: string
  color: string
  gradient: string
  icon: TablerIcon
}

// ---------------------------------------------------------------------------
// Маппинг строковых имён иконок → React-компоненты Tabler
// ---------------------------------------------------------------------------

export const ICON_MAP: Record<string, TablerIcon> = {
  IconTarget,
  IconBulb,
  IconSpeakerphone,
  IconArrowsSort,
  IconUsers,
  IconSearch,
  IconBrandNotion,
  IconNote,
  IconMicrophone2,
  IconFocus2,
  IconMovie,
  IconFishHook,
  IconBox,
  IconMoodSmile,
  IconDeviceTv,
  IconLayoutGrid,
  IconStairs,
  IconUsersGroup,
  IconQuestionMark,
}

export function resolveIcon(iconName: string): TablerIcon {
  return ICON_MAP[iconName] ?? IconQuestionMark
}

// ---------------------------------------------------------------------------
// Hardcoded fallback — используется пока API не загрузился
// ---------------------------------------------------------------------------

export const NODE_TYPE_CONFIG: Record<NodeType, NodeTypeConfig> = {
  target_audience: {
    label: 'Целевая аудитория',
    color: '#0A84FF',
    gradient: 'linear-gradient(135deg, #0A84FF, #3B9EFF)',
    icon: IconTarget,
  },
  meaning: {
    label: 'Смысл',
    color: '#FFD60A',
    gradient: 'linear-gradient(135deg, #FFD60A, #FFE44D)',
    icon: IconBulb,
  },
  channel: {
    label: 'Канал',
    color: '#30D158',
    gradient: 'linear-gradient(135deg, #30D158, #5CE07A)',
    icon: IconSpeakerphone,
  },
  funnel: {
    label: 'Воронка',
    color: '#BF5AF2',
    gradient: 'linear-gradient(135deg, #BF5AF2, #D084F5)',
    icon: IconArrowsSort,
  },
  competitor: {
    label: 'Конкурент',
    color: '#FF453A',
    gradient: 'linear-gradient(135deg, #FF453A, #FF6961)',
    icon: IconUsers,
  },
  seo: {
    label: 'SEO',
    color: '#FF9F0A',
    gradient: 'linear-gradient(135deg, #FF9F0A, #FFB84D)',
    icon: IconSearch,
  },
  brand: {
    label: 'Бренд',
    color: '#32ADE6',
    gradient: 'linear-gradient(135deg, #32ADE6, #5CC2EE)',
    icon: IconBrandNotion,
  },
  note: {
    label: 'Заметка',
    color: '#8E8E93',
    gradient: 'linear-gradient(135deg, #8E8E93, #AEAEB2)',
    icon: IconNote,
  },
  speaker: {
    label: 'Спикер',
    color: '#5856D6',
    gradient: 'linear-gradient(135deg, #5856D6, #7A79E0)',
    icon: IconMicrophone2,
  },
  content_goal: {
    label: 'Цель контента',
    color: '#34C759',
    gradient: 'linear-gradient(135deg, #34C759, #5DD57A)',
    icon: IconFocus2,
  },
  narrative_format: {
    label: 'Формат нарратива',
    color: '#AF52DE',
    gradient: 'linear-gradient(135deg, #AF52DE, #C77CE6)',
    icon: IconMovie,
  },
  hook_type: {
    label: 'Тип хука',
    color: '#FF2D55',
    gradient: 'linear-gradient(135deg, #FF2D55, #FF6482)',
    icon: IconFishHook,
  },
  product_focus: {
    label: 'Фокус продукта',
    color: '#00C7BE',
    gradient: 'linear-gradient(135deg, #00C7BE, #33D4CD)',
    icon: IconBox,
  },
  tone_of_voice: {
    label: 'Тон голоса',
    color: '#FF6B35',
    gradient: 'linear-gradient(135deg, #FF6B35, #FF8F64)',
    icon: IconMoodSmile,
  },
  platform: {
    label: 'Платформа',
    color: '#007AFF',
    gradient: 'linear-gradient(135deg, #007AFF, #4DA3FF)',
    icon: IconDeviceTv,
  },
  content_format: {
    label: 'Формат контента',
    color: '#FF9500',
    gradient: 'linear-gradient(135deg, #FF9500, #FFAD33)',
    icon: IconLayoutGrid,
  },
  hunt_level: {
    label: 'Уровень Ханта',
    color: '#5856D6',
    gradient: 'linear-gradient(135deg, #5856D6, #7A78E0)',
    icon: IconStairs,
  },
  audience_segment: {
    label: 'Сегмент аудитории',
    color: '#FF2D92',
    gradient: 'linear-gradient(135deg, #FF2D92, #FF64AD)',
    icon: IconUsersGroup,
  },
}

// ---------------------------------------------------------------------------
// Построение конфига из API-ответа
// ---------------------------------------------------------------------------

function defaultGradient(color: string): string {
  return `linear-gradient(135deg, ${color}, ${color}99)`
}

export function buildNodeTypeConfig(
  apiTypes: KgNodeTypeDefResponse[],
): Record<string, NodeTypeConfig> {
  const result: Record<string, NodeTypeConfig> = {}
  for (const t of apiTypes) {
    if (!t.is_active) continue
    result[t.slug] = {
      label: t.label,
      color: t.color,
      gradient: t.gradient ?? defaultGradient(t.color),
      icon: resolveIcon(t.icon),
    }
  }
  return result
}

export function mergeNodeTypeConfig(
  apiConfig: Record<string, NodeTypeConfig> | undefined,
): Record<string, NodeTypeConfig> {
  if (!apiConfig) return NODE_TYPE_CONFIG
  return { ...NODE_TYPE_CONFIG, ...apiConfig }
}

// ---------------------------------------------------------------------------
// Публичные утилиты (обратная совместимость)
// ---------------------------------------------------------------------------

export const NODE_TYPE_OPTIONS = Object.entries(NODE_TYPE_CONFIG).map(
  ([value, config]) => ({
    value,
    label: config.label,
  }),
)

export function buildNodeTypeOptions(
  config: Record<string, NodeTypeConfig>,
): Array<{ value: string; label: string }> {
  return Object.entries(config).map(([value, c]) => ({
    value,
    label: c.label,
  }))
}

export function getNodeTypeConfig(
  nodeType: string,
  config?: Record<string, NodeTypeConfig>,
): NodeTypeConfig {
  if (config) {
    return config[nodeType] ?? config['note'] ?? NODE_TYPE_CONFIG.note
  }
  return NODE_TYPE_CONFIG[nodeType as NodeType] ?? NODE_TYPE_CONFIG.note
}
