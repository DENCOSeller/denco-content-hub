'use client'

import { Group, Stack, Skeleton } from '@mantine/core'
import styles from './competitors.module.css'

export function ChannelCardSkeleton() {
  return (
    <div className={styles.skeletonCard}>
      <Stack gap="sm">
        <Group gap="md" wrap="nowrap">
          <Skeleton circle height={44} width={44} />
          <Stack gap={6} style={{ flex: 1 }}>
            <Skeleton height={14} width="60%" />
            <Skeleton height={12} width="40%" />
          </Stack>
        </Group>
        <Group gap="md">
          <Skeleton height={12} width={60} />
          <Skeleton height={12} width={60} />
          <Skeleton height={12} width={60} />
        </Group>
      </Stack>
    </div>
  )
}

export function ChannelGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className={styles.channelGrid}>
      {Array.from({ length: count }).map((_, i) => (
        <ChannelCardSkeleton key={i} />
      ))}
    </div>
  )
}
