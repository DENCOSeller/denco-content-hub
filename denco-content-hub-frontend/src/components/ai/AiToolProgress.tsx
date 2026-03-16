'use client'

import { IconSearch, IconLink, IconChartBar, IconWorld } from '@tabler/icons-react'
import type { ComponentType } from 'react'
import styles from './AiToolProgress.module.css'

interface ToolConfig {
  icon: ComponentType<{ size?: number }>
  label: string
}

const TOOL_MAP: Record<string, ToolConfig> = {
  search_knowledge_nodes: {
    icon: IconSearch,
    label: 'Ищу в базе знаний...',
  },
  get_node_with_edges: {
    icon: IconLink,
    label: 'Загружаю связи узла...',
  },
  get_workspace_overview: {
    icon: IconChartBar,
    label: 'Получаю обзор воркспейса...',
  },
  search_across_workspaces: {
    icon: IconWorld,
    label: 'Ищу по всем проектам...',
  },
}

const DEFAULT_TOOL: ToolConfig = {
  icon: IconSearch,
  label: 'Обрабатываю...',
}

interface AiToolProgressProps {
  tools: string[]
}

export function AiToolProgress({ tools }: AiToolProgressProps) {
  if (tools.length === 0) return null

  // Show unique tools only, preserve order
  const seen = new Set<string>()
  const uniqueTools: string[] = []
  for (const tool of tools) {
    if (!seen.has(tool)) {
      seen.add(tool)
      uniqueTools.push(tool)
    }
  }

  return (
    <div className={styles.container}>
      {uniqueTools.map((tool) => {
        const config = TOOL_MAP[tool] ?? DEFAULT_TOOL
        const Icon = config.icon
        return (
          <div key={tool} className={styles.toolItem}>
            <div className={styles.iconWrapper}>
              <Icon size={14} />
            </div>
            <span className={styles.label}>{config.label}</span>
          </div>
        )
      })}
    </div>
  )
}
