'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react'
import {
  IconTypography,
  IconH2,
  IconH3,
  IconList,
  IconListNumbers,
  IconListCheck,
  IconBlockquote,
  IconMinus,
  IconCode,
} from '@tabler/icons-react'
import type { Editor, Range } from '@tiptap/core'

import styles from './SlashCommandsList.module.css'

export interface SlashCommandItem {
  title: string
  description: string
  icon: string
  command: (props: { editor: Editor; range: Range }) => void
}

interface SlashCommandsListProps {
  items: SlashCommandItem[]
  command: (item: SlashCommandItem) => void
}

const ICON_MAP: Record<string, typeof IconTypography> = {
  paragraph: IconTypography,
  h2: IconH2,
  h3: IconH3,
  bulletList: IconList,
  orderedList: IconListNumbers,
  taskList: IconListCheck,
  blockquote: IconBlockquote,
  horizontalRule: IconMinus,
  codeBlock: IconCode,
}

export const SlashCommandsList = forwardRef<
  { onKeyDown: (e: KeyboardEvent) => boolean },
  SlashCommandsListProps
>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    setSelectedIndex(0)
  }, [items])

  const selectItem = useCallback(
    (index: number) => {
      const item = items[index]
      if (item) {
        command(item)
      }
    },
    [items, command],
  )

  useImperativeHandle(ref, () => ({
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((prev) =>
          prev <= 0 ? items.length - 1 : prev - 1,
        )
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((prev) =>
          prev >= items.length - 1 ? 0 : prev + 1,
        )
        return true
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex)
        return true
      }
      return false
    },
  }))

  if (items.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>Ничего не найдено</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {items.map((item, index) => {
        const Icon = ICON_MAP[item.icon] ?? IconTypography
        return (
          <button
            key={item.title}
            type="button"
            className={`${styles.item} ${index === selectedIndex ? styles.itemSelected : ''}`}
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div className={styles.itemIcon}>
              <Icon size={18} stroke={1.5} />
            </div>
            <div className={styles.itemText}>
              <span className={styles.itemTitle}>{item.title}</span>
              <span className={styles.itemDescription}>
                {item.description}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
})

SlashCommandsList.displayName = 'SlashCommandsList'
