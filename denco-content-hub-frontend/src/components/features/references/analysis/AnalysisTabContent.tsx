'use client'

import { type ReactNode } from 'react'
import {
  Center,
  Stack,
  Text,
  Button,
  Skeleton,
  ThemeIcon,
} from '@mantine/core'
import { IconSparkles, IconInbox } from '@tabler/icons-react'

import type { AnalysisStatus } from './types'
import styles from './analysis-tabs.module.css'

// ─── Props ───────────────────────────────────────────────────────────────────

interface AnalysisTabContentProps {
  status: AnalysisStatus
  children: ReactNode
  onGenerate?: () => void
  generateLabel?: string
  isGenerating?: boolean
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AnalysisTabContent({
  status,
  children,
  onGenerate,
  generateLabel = 'Сгенерировать',
  isGenerating = false,
}: AnalysisTabContentProps) {
  if (status === 'loading') {
    return (
      <Stack gap="md">
        <Skeleton height={16} radius="sm" />
        <Skeleton height={16} radius="sm" width="90%" />
        <Skeleton height={16} radius="sm" width="75%" />
        <Skeleton height={80} radius="md" mt="sm" />
        <Skeleton height={80} radius="md" />
      </Stack>
    )
  }

  if (status === 'empty') {
    return (
      <Center py="xl">
        <div className={styles.emptyWrapper}>
          <ThemeIcon size="xl" variant="light" color="gray">
            <IconInbox />
          </ThemeIcon>
          <Text c="dimmed" size="sm" ta="center">
            Данные анализа отсутствуют
          </Text>
          {onGenerate && (
            <Button
              leftSection={<IconSparkles size={16} />}
              variant="light"
              onClick={onGenerate}
              loading={isGenerating}
            >
              {generateLabel}
            </Button>
          )}
        </div>
      </Center>
    )
  }

  return <>{children}</>
}
