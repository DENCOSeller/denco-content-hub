'use client'

import { SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core'
import {
  IconBrandYoutube,
  IconBrandInstagram,
  IconBrandTelegram,
  IconBrandVk,
} from '@tabler/icons-react'
import type { Platform } from '@/api/client/types.gen'
import type { WizardState } from './wizard-types'
import styles from './create-wizard.module.css'

interface StepPlatformProps {
  state: WizardState
  onChange: (updates: Partial<WizardState>) => void
}

const PLATFORMS: { value: Platform; label: string; icon: typeof IconBrandYoutube; color: string }[] = [
  { value: 'youtube', label: 'YouTube', icon: IconBrandYoutube, color: '#FF0000' },
  { value: 'instagram', label: 'Instagram', icon: IconBrandInstagram, color: '#E1306C' },
  { value: 'telegram', label: 'Telegram', icon: IconBrandTelegram, color: '#0088cc' },
  { value: 'vk', label: 'VK', icon: IconBrandVk, color: '#4680C2' },
]

export function StepPlatform({ state, onChange }: StepPlatformProps) {
  function handleSelect(platform: Platform) {
    onChange({
      platform,
      contentType: null,
      category: null,
    })
  }

  return (
    <Stack gap="lg">
      <Text size="lg" fw={600}>Выберите платформу</Text>
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        {PLATFORMS.map(({ value, label, icon: Icon, color }) => {
          const selected = state.platform === value
          return (
            <UnstyledButton
              key={value}
              className={`${styles.platformCard} ${selected ? styles.platformCardSelected : ''}`}
              onClick={() => handleSelect(value)}
              aria-label={`Платформа ${label}`}
              aria-pressed={selected}
            >
              <Stack align="center" gap="sm">
                <Icon size={48} color={selected ? color : 'var(--text-muted)'} />
                <Text size="sm" fw={selected ? 600 : 400}>
                  {label}
                </Text>
              </Stack>
            </UnstyledButton>
          )
        })}
      </SimpleGrid>
    </Stack>
  )
}
