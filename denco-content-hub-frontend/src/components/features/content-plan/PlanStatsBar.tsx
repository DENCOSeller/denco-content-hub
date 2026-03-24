'use client'

import { useMemo } from 'react'
import type { ContentPlanItemResponse } from '@/api/client/types.gen'

import styles from './plan-stats-bar.module.css'

const STATUS_COLOR: Record<string, string> = {
  scheduled: 'var(--eco-content)',
  published: '#22c55e',
  cancelled: 'var(--color-error)',
  overdue: '#eab308',
}

interface PlanStatsBarProps {
  items: ContentPlanItemResponse[]
}

interface StatItem {
  key: string
  label: string
  count: number
  color: string
}

export function PlanStatsBar({ items }: PlanStatsBarProps) {
  const stats = useMemo<StatItem[]>(() => {
    const now = new Date()
    let scheduled = 0
    let published = 0
    let cancelled = 0
    let overdue = 0

    for (const item of items) {
      switch (item.status) {
        case 'scheduled':
          if (new Date(item.scheduled_at) < now) {
            overdue++
          } else {
            scheduled++
          }
          break
        case 'published':
          published++
          break
        case 'cancelled':
          cancelled++
          break
      }
    }

    const result: StatItem[] = []

    if (scheduled > 0) {
      result.push({ key: 'scheduled', label: 'Запланировано', count: scheduled, color: STATUS_COLOR.scheduled })
    }
    if (published > 0) {
      result.push({ key: 'published', label: 'Опубликовано', count: published, color: STATUS_COLOR.published })
    }
    if (cancelled > 0) {
      result.push({ key: 'cancelled', label: 'Отменено', count: cancelled, color: STATUS_COLOR.cancelled })
    }
    if (overdue > 0) {
      result.push({ key: 'overdue', label: 'Просрочено', count: overdue, color: STATUS_COLOR.overdue })
    }

    return result
  }, [items])

  if (items.length === 0) return null

  return (
    <div className={styles.bar}>
      <span className={styles.total}>Всего: {items.length}</span>
      {stats.map((stat) => (
        <div
          key={stat.key}
          className={styles.stat}
          style={{ '--stat-color': stat.color } as React.CSSProperties}
        >
          <span className={styles.dot} />
          <span className={styles.count}>{stat.count}</span>
          <span className={styles.label}>{stat.label}</span>
        </div>
      ))}
    </div>
  )
}
