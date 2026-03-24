'use client'

import { useState } from 'react'
import { Stepper, Button, Group, Stack } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useRouter } from 'next/navigation'
import { IconArrowLeft, IconArrowRight, IconSparkles } from '@tabler/icons-react'
import { useCreateLibraryItemMutation, useGenerateLibraryContentMutation } from '@/api/hooks/useLibrary'
import type { LibraryItemCreate } from '@/api/client/types.gen'
import { INITIAL_WIZARD_STATE } from './wizard-types'
import type { WizardState } from './wizard-types'
import { StepPlatform } from './StepPlatform'
import { StepContentType } from './StepContentType'
import { StepSource } from './StepSource'
import { StepSettings } from './StepSettings'
import { StepPreview } from './StepPreview'
import styles from './create-wizard.module.css'

interface CreateWizardProps {
  workspaceId: number
}

const STEP_LABELS = ['Платформа', 'Тип и категория', 'Источник', 'Настройки', 'Превью']

export function CreateWizard({ workspaceId }: CreateWizardProps) {
  const router = useRouter()
  const isMobile = useMediaQuery('(max-width: 48em)')
  const [active, setActive] = useState(0)
  const [state, setState] = useState<WizardState>(INITIAL_WIZARD_STATE)

  const createMutation = useCreateLibraryItemMutation(workspaceId)
  const generateMutation = useGenerateLibraryContentMutation(workspaceId)

  function handleChange(updates: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...updates }))
  }

  function validateStep(step: number): boolean {
    switch (step) {
      case 0:
        if (!state.platform) {
          notifications.show({ color: 'red', message: 'Выберите платформу' })
          return false
        }
        return true
      case 1:
        if (!state.title.trim()) {
          notifications.show({ color: 'red', message: 'Введите тему контента' })
          return false
        }
        if (!state.contentType) {
          notifications.show({ color: 'red', message: 'Выберите тип контента' })
          return false
        }
        if (!state.category) {
          notifications.show({ color: 'red', message: 'Выберите категорию' })
          return false
        }
        return true
      case 2:
        if (!state.sourceType) {
          notifications.show({ color: 'red', message: 'Выберите источник материала' })
          return false
        }
        if (state.sourceType === 'reference' && !state.sourceReferenceId) {
          notifications.show({ color: 'red', message: 'Выберите референс' })
          return false
        }
        if (state.sourceType === 'knowledge' && state.sourceNodeIds.length === 0) {
          notifications.show({ color: 'red', message: 'Выберите хотя бы один узел' })
          return false
        }
        if (state.sourceType === 'manual' && !state.sourceText.trim()) {
          notifications.show({ color: 'red', message: 'Введите описание контента' })
          return false
        }
        if (!state.ideaText.trim()) {
          notifications.show({ color: 'red', message: 'Заполните поле «Замысел / Идея»' })
          return false
        }
        return true
      case 3:
        return true
      default:
        return true
    }
  }

  function handleNext() {
    if (!validateStep(active)) return
    setActive((prev) => Math.min(prev + 1, 4))
  }

  function handleBack() {
    setActive((prev) => {
      const next = Math.max(prev - 1, 0)
      if (next <= 0) {
        setState((s) => ({ ...s, contentType: null, category: null }))
      }
      return next
    })
  }

  async function handleCreate() {
    if (!state.platform || !state.contentType || !state.category || !state.sourceType || !state.title.trim()) {
      notifications.show({ color: 'red', message: 'Заполните все обязательные поля' })
      return
    }

    const body: LibraryItemCreate = {
      platform: state.platform,
      content_type: state.contentType as LibraryItemCreate['content_type'],
      category: state.category,
      hunt_level: state.huntLevel ?? 1,
      source_type: state.sourceType,
      source_reference_id: state.sourceReferenceId,
      source_text: state.sourceType === 'manual'
        ? `${state.ideaText}\n\n${state.sourceText}`
        : state.ideaText,
      title: state.title.trim(),
      speaker_node_id: state.speakerNodeId,
      content_goal_node_id: state.contentGoalNodeId,
      narrative_node_id: state.narrativeNodeId,
      hook_type_node_id: state.hookTypeNodeId,
      product_node_id: state.productNodeId,
      tone_node_id: state.toneNodeId,
    }

    try {
      const item = await createMutation.mutateAsync(body)
      if (item?.id) {
        try {
          await generateMutation.mutateAsync(item.id)
          notifications.show({ color: 'green', message: 'Контент создан и генерация запущена!' })
        } catch (genError) {
          console.error('Ошибка генерации:', genError)
          notifications.show({
            color: 'yellow',
            title: 'Контент создан',
            message: 'Генерация не удалась. Попробуйте запустить генерацию повторно.',
          })
        }
        router.push(`/workspaces/${workspaceId}/library/${item.id}`)
      }
    } catch (error) {
      console.error('Ошибка создания контента:', error)
      const message = error instanceof Error ? error.message : 'Ошибка при создании контента'
      notifications.show({ color: 'red', message })
    }
  }

  const isSubmitting = createMutation.isPending || generateMutation.isPending

  return (
    <Stack gap="xl">
      <Stepper
        active={active}
        onStepClick={setActive}
        size="sm"
        allowNextStepsSelect={false}
        color="teal"
        orientation={isMobile ? 'vertical' : 'horizontal'}
        className={styles.wizardStepper}
      >
        {STEP_LABELS.map((label) => (
          <Stepper.Step key={label} label={label} />
        ))}
      </Stepper>

      {active === 0 && <StepPlatform state={state} onChange={handleChange} />}
      {active === 1 && <StepContentType state={state} onChange={handleChange} />}
      {active === 2 && <StepSource state={state} onChange={handleChange} workspaceId={workspaceId} />}
      {active === 3 && <StepSettings state={state} onChange={handleChange} workspaceId={workspaceId} />}
      {active === 4 && <StepPreview state={state} />}

      <Group justify="space-between">
        <Button
          variant="default"
          leftSection={<IconArrowLeft size={16} />}
          onClick={handleBack}
          disabled={active === 0}
        >
          Назад
        </Button>

        {active < 4 ? (
          <Button
            color="teal"
            rightSection={<IconArrowRight size={16} />}
            onClick={handleNext}
          >
            Далее
          </Button>
        ) : (
          <Button
            color="teal"
            leftSection={<IconSparkles size={16} />}
            onClick={handleCreate}
            loading={isSubmitting}
          >
            Создать и сгенерировать
          </Button>
        )}
      </Group>
    </Stack>
  )
}
