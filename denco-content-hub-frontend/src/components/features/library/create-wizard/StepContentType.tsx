'use client'

import { SimpleGrid, Stack, Text, TextInput, UnstyledButton } from '@mantine/core'
import type { Category } from '@/api/client/types.gen'
import { PLATFORM_CONTENT_TYPES, CATEGORY_OPTIONS } from './wizard-types'
import type { WizardState } from './wizard-types'
import styles from './create-wizard.module.css'

interface StepContentTypeProps {
  state: WizardState
  onChange: (updates: Partial<WizardState>) => void
}

export function StepContentType({ state, onChange }: StepContentTypeProps) {
  const contentTypes = state.platform ? PLATFORM_CONTENT_TYPES[state.platform] : []

  function handleContentType(value: string) {
    onChange({ contentType: value as WizardState['contentType'] })
  }

  function handleCategory(value: Category) {
    onChange({ category: value })
  }

  return (
    <Stack gap="xl">
      <TextInput
        label="Тема контента"
        placeholder="Например: Как выйти на Wildberries без склада за 3 дня"
        required
        value={state.title}
        onChange={(e) => onChange({ title: e.currentTarget.value })}
      />

      <Stack gap="md">
        <Text size="lg" fw={600}>Тип контента</Text>
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          {contentTypes.map(({ value, label }) => {
            const selected = state.contentType === value
            return (
              <UnstyledButton
                key={value}
                className={`${styles.typeCard} ${selected ? styles.typeCardSelected : ''}`}
                onClick={() => handleContentType(value)}
                aria-label={`Тип контента ${label}`}
                aria-pressed={selected}
              >
                <Text size="sm" fw={selected ? 600 : 400} ta="center">
                  {label}
                </Text>
              </UnstyledButton>
            )
          })}
        </SimpleGrid>
      </Stack>

      <Stack gap="md">
        <Text size="lg" fw={600}>Категория контента</Text>
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          {CATEGORY_OPTIONS.map(({ value, label }) => {
            const selected = state.category === value
            return (
              <UnstyledButton
                key={value}
                className={`${styles.typeCard} ${selected ? styles.typeCardSelected : ''}`}
                onClick={() => handleCategory(value)}
                aria-label={`Категория ${label}`}
                aria-pressed={selected}
              >
                <Text size="sm" fw={selected ? 600 : 400} ta="center">
                  {label}
                </Text>
              </UnstyledButton>
            )
          })}
        </SimpleGrid>
      </Stack>
    </Stack>
  )
}
