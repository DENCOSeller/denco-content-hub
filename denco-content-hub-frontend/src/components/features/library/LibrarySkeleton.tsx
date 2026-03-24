'use client'

import { Card, Group, Stack, Skeleton, SimpleGrid } from '@mantine/core'

import styles from './LibrarySkeleton.module.css'

interface LibrarySkeletonProps {
  viewMode: 'grid' | 'list'
}

function GridSkeletonCard() {
  return (
    <Card padding="md" radius="md" className={styles.card}>
      <Stack gap="sm">
        <Skeleton height={120} radius="sm" />
        <Skeleton height={16} width="70%" />
        <Group gap="xs">
          <Skeleton height={12} width={60} />
          <Skeleton height={12} width={80} />
        </Group>
        <Group gap="xs">
          <Skeleton height={22} width={70} radius="xl" />
          <Skeleton height={22} width={60} radius="xl" />
        </Group>
      </Stack>
    </Card>
  )
}

function ListSkeletonRow() {
  return (
    <Card padding="md" radius="md" className={styles.card}>
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" style={{ flex: 1 }}>
          <Skeleton height={40} width={40} radius="sm" />
          <Stack gap={4} style={{ flex: 1 }}>
            <Skeleton height={16} width="40%" />
            <Group gap="xs">
              <Skeleton height={12} width={60} />
              <Skeleton height={12} width={80} />
              <Skeleton height={12} width={70} />
            </Group>
          </Stack>
        </Group>
        <Group gap="xs" wrap="nowrap">
          <Skeleton height={22} width={65} radius="xl" />
          <Skeleton height={22} width={55} radius="xl" />
          <Skeleton height={24} width={24} radius="sm" />
          <Skeleton height={24} width={24} radius="sm" />
        </Group>
      </Group>
    </Card>
  )
}

export function LibrarySkeleton({ viewMode }: LibrarySkeletonProps) {
  if (viewMode === 'grid') {
    return (
      <SimpleGrid cols={{ base: 1, xs: 2, md: 3 }} spacing="md">
        {Array.from({ length: 6 }).map((_, i) => (
          <GridSkeletonCard key={i} />
        ))}
      </SimpleGrid>
    )
  }

  return (
    <Stack gap="sm">
      {Array.from({ length: 5 }).map((_, i) => (
        <ListSkeletonRow key={i} />
      ))}
    </Stack>
  )
}
