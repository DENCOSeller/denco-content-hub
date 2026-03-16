'use client'

import { ActionIcon } from '@mantine/core'
import { Badge, Group, Text } from '@mantine/core'
import {
  IconAlignLeft,
  IconBlockquote,
  IconBolt,
  IconBook2,
  IconCamera,
  IconClock,
  IconHash,
  IconHeading,
  IconLayoutCards,
  IconMovie,
  IconPencil,
  IconSparkles,
  IconTag,
  IconTargetArrow,
} from '@tabler/icons-react'
import type { ReactNode } from 'react'

import { markdownToHtml } from '@/lib/markdown-to-html'

import styles from './content-blocks-view.module.css'

// ---------------------------------------------------------------------------
// Field config
// ---------------------------------------------------------------------------

export const FIELD_CONFIG: Record<string, { label: string; icon: typeof IconHeading }> = {
  title: { label: 'Заголовок', icon: IconHeading },
  hook: { label: 'Хук', icon: IconBolt },
  body: { label: 'Основной текст', icon: IconAlignLeft },
  description: { label: 'Описание', icon: IconPencil },
  caption: { label: 'Подпись', icon: IconBlockquote },
  cta: { label: 'Призыв к действию', icon: IconTargetArrow },
  visual_hint: { label: 'Визуал', icon: IconCamera },
  duration_hint: { label: 'Хронометраж', icon: IconClock },
  hashtags: { label: 'Хештеги', icon: IconHash },
  tags: { label: 'Теги', icon: IconTag },
  chapters: { label: 'Главы', icon: IconBook2 },
  slides: { label: 'Слайды', icon: IconLayoutCards },
  storyboard: { label: 'Сценарий', icon: IconMovie },
}

// ---------------------------------------------------------------------------
// Block primitives
// ---------------------------------------------------------------------------

function BlockWrapper({ label, icon: Icon, children, onAiClick }: {
  label: string
  icon: typeof IconHeading
  children: ReactNode
  onAiClick?: () => void
}) {
  return (
    <div className={styles.block}>
      <div className={styles.blockHeader}>
        <Icon size={14} className={styles.blockIcon} />
        <span className={styles.blockLabel}>{label}</span>
        {onAiClick && (
          <ActionIcon
            variant="subtle"
            size="xs"
            className={styles.aiButton}
            onClick={onAiClick}
            aria-label="Улучшить с AI"
          >
            <IconSparkles size={13} />
          </ActionIcon>
        )}
      </div>
      {children}
    </div>
  )
}

function MarkdownBlock({ label, icon, value, onAiClick }: {
  label: string
  icon: typeof IconHeading
  value: string
  onAiClick?: () => void
}) {
  const html = markdownToHtml(value)
  if (!html) return null
  return (
    <BlockWrapper label={label} icon={icon} onAiClick={onAiClick}>
      <div
        className={styles.blockContent}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </BlockWrapper>
  )
}

function TagsBlock({ label, icon, tags }: {
  label: string
  icon: typeof IconHeading
  tags: string[]
}) {
  return (
    <BlockWrapper label={label} icon={icon}>
      <div className={styles.tagsList}>
        {tags.map((tag, i) => (
          <Badge key={i} variant="outline" color="gray" size="sm">
            {tag}
          </Badge>
        ))}
      </div>
    </BlockWrapper>
  )
}

// ---------------------------------------------------------------------------
// Array blocks
// ---------------------------------------------------------------------------

function ChaptersBlock({ chapters }: {
  chapters: Array<{ time?: string; title?: string; content?: string }>
}) {
  const cfg = FIELD_CONFIG.chapters
  return (
    <BlockWrapper label={cfg.label} icon={cfg.icon}>
      <div className={styles.nestedStack}>
        {chapters.map((ch, i) => (
          <div key={i} className={styles.nestedCard}>
            <div className={styles.nestedHeader}>
              <Text size="xs" c="dimmed" fw={600}>Глава {i + 1}</Text>
              {ch.time && <Badge variant="light" color="blue" size="xs">{ch.time}</Badge>}
              {ch.title && <Text size="sm" fw={500}>{ch.title}</Text>}
            </div>
            {ch.content && (
              <div
                className={styles.blockContent}
                dangerouslySetInnerHTML={{ __html: markdownToHtml(ch.content) }}
              />
            )}
          </div>
        ))}
      </div>
    </BlockWrapper>
  )
}

function SlidesBlock({ slides }: {
  slides: Array<{ title?: string; body?: string; visual_hint?: string }>
}) {
  const cfg = FIELD_CONFIG.slides
  return (
    <BlockWrapper label={cfg.label} icon={cfg.icon}>
      <div className={styles.nestedStack}>
        {slides.map((slide, i) => (
          <div key={i} className={styles.nestedCard}>
            <Group gap="xs" mb={4}>
              <Badge variant="filled" color="dark" size="xs" radius="sm">
                {i + 1}
              </Badge>
              {slide.title && <Text size="sm" fw={500}>{slide.title}</Text>}
            </Group>
            {slide.body && (
              <div
                className={styles.blockContent}
                dangerouslySetInnerHTML={{ __html: markdownToHtml(slide.body) }}
              />
            )}
            {slide.visual_hint && (
              <Group gap={4} mt={6}>
                <IconCamera size={12} style={{ color: 'var(--text-muted)' }} />
                <Text size="xs" c="dimmed">{slide.visual_hint}</Text>
              </Group>
            )}
          </div>
        ))}
      </div>
    </BlockWrapper>
  )
}

function StoryboardBlock({ scenes }: { scenes: string[] }) {
  const cfg = FIELD_CONFIG.storyboard
  return (
    <BlockWrapper label={cfg.label} icon={cfg.icon}>
      <div className={styles.nestedStack}>
        {scenes.map((scene, i) => (
          <div key={i} className={styles.nestedCard}>
            <Group gap="xs" mb={4}>
              <Badge variant="filled" color="dark" size="xs" radius="sm">
                {i + 1}
              </Badge>
              <Text size="xs" c="dimmed" fw={600}>Сцена</Text>
            </Group>
            <div
              className={styles.blockContent}
              dangerouslySetInnerHTML={{ __html: markdownToHtml(scene) }}
            />
          </div>
        ))}
      </div>
    </BlockWrapper>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ContentBlocksViewProps {
  content: Record<string, unknown>
  contentType?: string
  onAiImprove?: (fieldName: string, fieldLabel: string, fieldValue: string) => void
}

/** Ordered list of simple text fields to render */
const TEXT_FIELDS = [
  'title', 'hook', 'body', 'description', 'caption',
  'cta', 'duration_hint', 'visual_hint',
] as const

export function ContentBlocksView({ content, onAiImprove }: ContentBlocksViewProps) {
  if (!content || Object.keys(content).length === 0) return null

  // raw_text fallback
  if (typeof content.raw_text === 'string') {
    const html = markdownToHtml(content.raw_text)
    return (
      <div className={styles.blocksStack}>
        <BlockWrapper label="Текст" icon={IconAlignLeft}>
          <div
            className={styles.blockContent}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </BlockWrapper>
      </div>
    )
  }

  return (
    <div className={styles.blocksStack}>
      {/* Text fields */}
      {TEXT_FIELDS.map((field) => {
        const value = content[field]
        if (typeof value !== 'string' || !value) return null
        const cfg = FIELD_CONFIG[field] ?? { label: field, icon: IconAlignLeft }
        return (
          <MarkdownBlock
            key={field}
            label={cfg.label}
            icon={cfg.icon}
            value={value}
            onAiClick={
              onAiImprove
                ? () => onAiImprove(field, cfg.label, value)
                : undefined
            }
          />
        )
      })}

      {/* Storyboard */}
      {Array.isArray(content.storyboard) && content.storyboard.length > 0 && (
        <StoryboardBlock scenes={content.storyboard as string[]} />
      )}

      {/* Chapters */}
      {Array.isArray(content.chapters) && content.chapters.length > 0 && (
        <ChaptersBlock
          chapters={content.chapters as Array<{ time?: string; title?: string; content?: string }>}
        />
      )}

      {/* Slides */}
      {Array.isArray(content.slides) && content.slides.length > 0 && (
        <SlidesBlock
          slides={content.slides as Array<{ title?: string; body?: string; visual_hint?: string }>}
        />
      )}

      {/* Tags */}
      {Array.isArray(content.hashtags) && content.hashtags.length > 0 && (
        <TagsBlock
          label={FIELD_CONFIG.hashtags.label}
          icon={FIELD_CONFIG.hashtags.icon}
          tags={content.hashtags as string[]}
        />
      )}
      {Array.isArray(content.tags) && content.tags.length > 0 && (
        <TagsBlock
          label={FIELD_CONFIG.tags.label}
          icon={FIELD_CONFIG.tags.icon}
          tags={content.tags as string[]}
        />
      )}
    </div>
  )
}
