'use client'

import type { TablerIcon } from '@tabler/icons-react'
import { IconTrendingUp, IconTrendingDown, IconMinus } from '@tabler/icons-react'

import styles from './KpiCard.module.css'

interface KpiCardProps {
  icon: TablerIcon
  value: number | string
  label: string
  trend?: {
    value: number
    direction: 'up' | 'down' | 'neutral'
  }
  loading?: boolean
}

export function KpiCard({ icon: Icon, value, label, trend, loading }: KpiCardProps) {
  if (loading) {
    return (
      <div className={styles.skeleton}>
        <div className={styles.skeletonIcon} />
        <div className={styles.skeletonValue} />
        <div className={styles.skeletonLabel} />
      </div>
    )
  }

  const getTrendIcon = () => {
    if (!trend) return null
    switch (trend.direction) {
      case 'up':
        return <IconTrendingUp size={14} />
      case 'down':
        return <IconTrendingDown size={14} />
      default:
        return <IconMinus size={14} />
    }
  }

  const getTrendClass = () => {
    if (!trend) return ''
    switch (trend.direction) {
      case 'up':
        return styles.trendUp
      case 'down':
        return styles.trendDown
      default:
        return styles.trendNeutral
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.iconWrapper}>
          <Icon size={20} />
        </div>
        {trend && (
          <span className={`${styles.trend} ${getTrendClass()}`}>
            {getTrendIcon()}
            {trend.direction !== 'neutral' && `${trend.value}%`}
          </span>
        )}
      </div>
      <div className={styles.value}>{value}</div>
      <div className={styles.label}>{label}</div>
    </div>
  )
}

export function KpiCardSkeleton() {
  return (
    <div className={styles.skeleton}>
      <div className={styles.skeletonIcon} />
      <div className={styles.skeletonValue} />
      <div className={styles.skeletonLabel} />
    </div>
  )
}
