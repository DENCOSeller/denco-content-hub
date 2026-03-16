'use client'

import { useEffect, useRef } from 'react'
import {
  IconSearch,
  IconLayoutDashboard,
  IconWorldSearch,
  IconArrowsShuffle,
} from '@tabler/icons-react'
import styles from './AiSlashCommands.module.css'

export interface SlashCommand {
  command: string
  label: string
  description: string
  template: string
  icon: React.ComponentType<{ size?: number }>
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    command: '/search',
    label: '/search [запрос]',
    description: 'Найди в базе знаний',
    template: 'Найди в базе знаний: ',
    icon: IconSearch,
  },
  {
    command: '/overview',
    label: '/overview',
    description: 'Обзор текущего воркспейса',
    template: 'Покажи обзор текущего воркспейса',
    icon: IconLayoutDashboard,
  },
  {
    command: '/find-all',
    label: '/find-all [запрос]',
    description: 'Поиск по всем проектам компании',
    template: 'Найди по всем проектам компании: ',
    icon: IconWorldSearch,
  },
  {
    command: '/connections',
    label: '/connections [название]',
    description: 'Показать все связи узла',
    template: 'Покажи все связи узла: ',
    icon: IconArrowsShuffle,
  },
]

interface AiSlashCommandsProps {
  filter: string
  activeIndex: number
  onSelect: (command: SlashCommand) => void
}

export function getFilteredCommands(filter: string): SlashCommand[] {
  if (!filter) return SLASH_COMMANDS
  const lower = filter.toLowerCase()
  return SLASH_COMMANDS.filter((cmd) => cmd.command.toLowerCase().includes(lower))
}

export function AiSlashCommands({ filter, activeIndex, onSelect }: AiSlashCommandsProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const filtered = getFilteredCommands(filter)

  useEffect(() => {
    const activeEl = listRef.current?.children[activeIndex] as HTMLElement | undefined
    activeEl?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (filtered.length === 0) return null

  return (
    <div className={styles.dropdown} ref={listRef}>
      {filtered.map((cmd, index) => {
        const Icon = cmd.icon
        return (
          <button
            key={cmd.command}
            type="button"
            className={`${styles.item} ${index === activeIndex ? styles.active : ''}`}
            onMouseDown={(e) => {
              e.preventDefault()
              onSelect(cmd)
            }}
          >
            <div className={styles.iconWrapper}>
              <Icon size={16} />
            </div>
            <div className={styles.content}>
              <span className={styles.command}>{cmd.label}</span>
              <span className={styles.description}>{cmd.description}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
