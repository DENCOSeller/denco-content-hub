'use client'

import { ActionIcon, Group, TagsInput, Text, TextInput, Textarea } from '@mantine/core'
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
  IconPlus,
  IconTag,
  IconTargetArrow,
  IconTrash,
} from '@tabler/icons-react'
import type { ReactNode } from 'react'

import styles from './content-blocks-view.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ContentData = Record<string, unknown>
type Chapter = { time?: string; title?: string; content?: string }
type Slide = { title?: string; body?: string; visual_hint?: string }

interface ContentBlocksEditProps {
  content: ContentData
  onChange: (content: ContentData) => void
}

// ---------------------------------------------------------------------------
// Field config (same as view)
// ---------------------------------------------------------------------------

const FIELD_CONFIG: Record<string, { label: string; icon: typeof IconHeading }> = {
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

const TEXT_FIELDS = [
  'title', 'hook', 'body', 'description', 'caption',
  'cta', 'duration_hint', 'visual_hint',
] as const

// ---------------------------------------------------------------------------
// Block wrapper
// ---------------------------------------------------------------------------

function EditBlockWrapper({ label, icon: Icon, actions, children }: {
  label: string
  icon: typeof IconHeading
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className={styles.block}>
      <div className={styles.blockHeader}>
        <Icon size={14} className={styles.blockIcon} />
        <span className={styles.blockLabel}>{label}</span>
        {actions}
      </div>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Array editing helpers
// ---------------------------------------------------------------------------

function ChaptersEdit({ chapters, onChange }: {
  chapters: Chapter[]
  onChange: (chapters: Chapter[]) => void
}) {
  const cfg = FIELD_CONFIG.chapters
  function update(i: number, patch: Partial<Chapter>) {
    const next = chapters.map((ch, idx) => (idx === i ? { ...ch, ...patch } : ch))
    onChange(next)
  }
  function remove(i: number) { onChange(chapters.filter((_, idx) => idx !== i)) }
  function add() { onChange([...chapters, { time: '', title: '', content: '' }]) }

  return (
    <EditBlockWrapper label={cfg.label} icon={cfg.icon} actions={
      <ActionIcon variant="subtle" size="xs" color="gray" onClick={add} ml="auto"><IconPlus size={14} /></ActionIcon>
    }>
      <div className={styles.nestedStack}>
        {chapters.map((ch, i) => (
          <div key={i} className={styles.nestedCard}>
            <Group gap="xs" mb={6} justify="space-between">
              <Text size="xs" c="dimmed" fw={600}>Глава {i + 1}</Text>
              <ActionIcon variant="subtle" size="xs" color="red" onClick={() => remove(i)}><IconTrash size={12} /></ActionIcon>
            </Group>
            <Group gap="xs" mb={6} grow>
              <TextInput size="xs" placeholder="00:00" label="Время" value={ch.time ?? ''} onChange={(e) => update(i, { time: e.currentTarget.value })} />
              <TextInput size="xs" placeholder="Название" label="Заголовок" value={ch.title ?? ''} onChange={(e) => update(i, { title: e.currentTarget.value })} />
            </Group>
            <Textarea size="xs" label="Содержание" autosize minRows={2} maxRows={8} value={ch.content ?? ''} onChange={(e) => update(i, { content: e.currentTarget.value })} />
          </div>
        ))}
      </div>
    </EditBlockWrapper>
  )
}

function SlidesEdit({ slides, onChange }: {
  slides: Slide[]
  onChange: (slides: Slide[]) => void
}) {
  const cfg = FIELD_CONFIG.slides
  function update(i: number, patch: Partial<Slide>) {
    const next = slides.map((s, idx) => (idx === i ? { ...s, ...patch } : s))
    onChange(next)
  }
  function remove(i: number) { onChange(slides.filter((_, idx) => idx !== i)) }
  function add() { onChange([...slides, { title: '', body: '', visual_hint: '' }]) }

  return (
    <EditBlockWrapper label={cfg.label} icon={cfg.icon} actions={
      <ActionIcon variant="subtle" size="xs" color="gray" onClick={add} ml="auto"><IconPlus size={14} /></ActionIcon>
    }>
      <div className={styles.nestedStack}>
        {slides.map((slide, i) => (
          <div key={i} className={styles.nestedCard}>
            <Group gap="xs" mb={6} justify="space-between">
              <Text size="xs" c="dimmed" fw={600}>Слайд {i + 1}</Text>
              <ActionIcon variant="subtle" size="xs" color="red" onClick={() => remove(i)}><IconTrash size={12} /></ActionIcon>
            </Group>
            <TextInput size="xs" label="Заголовок" mb={6} value={slide.title ?? ''} onChange={(e) => update(i, { title: e.currentTarget.value })} />
            <Textarea size="xs" label="Текст" autosize minRows={2} maxRows={8} mb={6} value={slide.body ?? ''} onChange={(e) => update(i, { body: e.currentTarget.value })} />
            <Textarea size="xs" label="Визуал" autosize minRows={1} maxRows={3} value={slide.visual_hint ?? ''} onChange={(e) => update(i, { visual_hint: e.currentTarget.value })} />
          </div>
        ))}
      </div>
    </EditBlockWrapper>
  )
}

function StoryboardEdit({ scenes, onChange }: {
  scenes: string[]
  onChange: (scenes: string[]) => void
}) {
  const cfg = FIELD_CONFIG.storyboard
  function update(i: number, value: string) {
    const next = scenes.map((s, idx) => (idx === i ? value : s))
    onChange(next)
  }
  function remove(i: number) { onChange(scenes.filter((_, idx) => idx !== i)) }
  function add() { onChange([...scenes, '']) }

  return (
    <EditBlockWrapper label={cfg.label} icon={cfg.icon} actions={
      <ActionIcon variant="subtle" size="xs" color="gray" onClick={add} ml="auto"><IconPlus size={14} /></ActionIcon>
    }>
      <div className={styles.nestedStack}>
        {scenes.map((scene, i) => (
          <div key={i} className={styles.nestedCard}>
            <Group gap="xs" mb={6} justify="space-between">
              <Text size="xs" c="dimmed" fw={600}>Сцена {i + 1}</Text>
              <ActionIcon variant="subtle" size="xs" color="red" onClick={() => remove(i)}><IconTrash size={12} /></ActionIcon>
            </Group>
            <Textarea size="xs" autosize minRows={2} maxRows={8} value={scene} onChange={(e) => update(i, e.currentTarget.value)} />
          </div>
        ))}
      </div>
    </EditBlockWrapper>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ContentBlocksEdit({ content, onChange }: ContentBlocksEditProps) {
  function setField(field: string, value: unknown) {
    onChange({ ...content, [field]: value })
  }

  // raw_text fallback — single textarea
  if (typeof content.raw_text === 'string') {
    return (
      <div className={styles.blocksStack}>
        <EditBlockWrapper label="Текст" icon={IconAlignLeft}>
          <Textarea autosize minRows={10} maxRows={30} value={content.raw_text as string} onChange={(e) => setField('raw_text', e.currentTarget.value)} />
        </EditBlockWrapper>
      </div>
    )
  }

  return (
    <div className={styles.blocksStack}>
      {TEXT_FIELDS.map((field) => {
        const value = content[field]
        if (typeof value !== 'string') return null
        const cfg = FIELD_CONFIG[field] ?? { label: field, icon: IconAlignLeft }
        return (
          <EditBlockWrapper key={field} label={cfg.label} icon={cfg.icon}>
            <Textarea autosize minRows={2} maxRows={10} value={value} onChange={(e) => setField(field, e.currentTarget.value)} />
          </EditBlockWrapper>
        )
      })}

      {Array.isArray(content.storyboard) && (
        <StoryboardEdit scenes={content.storyboard as string[]} onChange={(v) => setField('storyboard', v)} />
      )}
      {Array.isArray(content.chapters) && (
        <ChaptersEdit chapters={content.chapters as Chapter[]} onChange={(v) => setField('chapters', v)} />
      )}
      {Array.isArray(content.slides) && (
        <SlidesEdit slides={content.slides as Slide[]} onChange={(v) => setField('slides', v)} />
      )}

      {Array.isArray(content.hashtags) && (
        <EditBlockWrapper label={FIELD_CONFIG.hashtags.label} icon={FIELD_CONFIG.hashtags.icon}>
          <TagsInput value={content.hashtags as string[]} onChange={(v) => setField('hashtags', v)} placeholder="Добавить хештег" />
        </EditBlockWrapper>
      )}
      {Array.isArray(content.tags) && (
        <EditBlockWrapper label={FIELD_CONFIG.tags.label} icon={FIELD_CONFIG.tags.icon}>
          <TagsInput value={content.tags as string[]} onChange={(v) => setField('tags', v)} placeholder="Добавить тег" />
        </EditBlockWrapper>
      )}
    </div>
  )
}
