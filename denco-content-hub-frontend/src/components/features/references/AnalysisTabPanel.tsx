'use client'

import { Button, Center, ScrollArea, Stack, Text } from '@mantine/core'
import { IconSparkles } from '@tabler/icons-react'

import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import type { AnalysisResponse, AnalysisType } from '@/api/analysis'
import { SummaryTab } from '@/components/features/references/analysis/SummaryTab'
import { ThesesTab } from '@/components/features/references/analysis/ThesesTab'
import { HooksTab } from '@/components/features/references/analysis/HooksTab'
import { StoryboardTab } from '@/components/features/references/analysis/StoryboardTab'
import { ContentIdeasTab } from '@/components/features/references/analysis/ContentIdeasTab'
import { AudienceInsightsTab } from '@/components/features/references/analysis/AudienceInsightsTab'
import { ProductionNotesTab } from '@/components/features/references/analysis/ProductionNotesTab'

function AnalysisContent({ type, analysis }: { type: AnalysisType; analysis: AnalysisResponse }) {
  switch (type) {
    case 'summary':
      if (!analysis.summary) return <ErrorState message="Данные анализа отсутствуют" />
      return <SummaryTab data={{ text: analysis.summary }} />
    case 'theses':
      if (!analysis.theses?.length) return <ErrorState message="Данные анализа отсутствуют" />
      return <ThesesTab data={analysis.theses} />
    case 'hooks':
      if (!analysis.hooks?.length) return <ErrorState message="Данные анализа отсутствуют" />
      return <HooksTab data={analysis.hooks} />
    case 'storyboard':
      if (!analysis.storyboard?.length) return <ErrorState message="Данные анализа отсутствуют" />
      return <StoryboardTab data={analysis.storyboard} />
    case 'content_ideas':
      if (!analysis.content_ideas?.length) return <ErrorState message="Данные анализа отсутствуют" />
      return <ContentIdeasTab data={analysis.content_ideas} />
    case 'audience_insights':
      if (!analysis.audience_insights) return <ErrorState message="Данные анализа отсутствуют" />
      return <AudienceInsightsTab data={analysis.audience_insights} />
    case 'production_notes':
      if (!analysis.production_notes) return <ErrorState message="Данные анализа отсутствуют" />
      return <ProductionNotesTab data={analysis.production_notes} />
    default:
      return <Text size="sm">Неизвестный тип анализа</Text>
  }
}

/** Check if specific analysis type has data in the flat response. */
function hasAnalysisData(analysis: AnalysisResponse, type: AnalysisType): boolean {
  switch (type) {
    case 'summary': return !!analysis.summary
    case 'theses': return !!analysis.theses?.length
    case 'hooks': return !!analysis.hooks?.length
    case 'storyboard': return !!analysis.storyboard?.length
    case 'content_ideas': return !!analysis.content_ideas?.length
    case 'audience_insights': return !!analysis.audience_insights
    case 'production_notes': return !!analysis.production_notes
    default: return false
  }
}

interface AnalysisTabPanelProps {
  type: AnalysisType
  label: string
  analysis: AnalysisResponse | undefined
  isAnalysisLoading: boolean
  isAnalysisError: boolean
  isGenerating: boolean
  onGenerate: () => void
  onRefetch: () => void
}

export function AnalysisTabPanel({
  type,
  label,
  analysis,
  isAnalysisLoading,
  isAnalysisError,
  isGenerating,
  onGenerate,
  onRefetch,
}: AnalysisTabPanelProps) {
  if (isAnalysisLoading) {
    return <LoadingState message={`Загрузка ${label.toLowerCase()}...`} />
  }

  if (isAnalysisError) {
    return <ErrorState message={`Не удалось загрузить ${label.toLowerCase()}`} onRetry={onRefetch} />
  }

  const status = analysis?.status
  const hasData = analysis ? hasAnalysisData(analysis, type) : false

  if (!analysis || (!hasData && status !== 'processing' && status !== 'pending')) {
    return (
      <Center py="xl" flex={1}>
        <Stack align="center" gap="md">
          <Text c="dimmed" size="sm">
            {label} ещё не сгенерирован
          </Text>
          <Button
            variant="light"
            leftSection={<IconSparkles size={16} />}
            loading={isGenerating}
            onClick={onGenerate}
          >
            Сгенерировать
          </Button>
        </Stack>
      </Center>
    )
  }

  if (status === 'pending' || status === 'processing') {
    return <LoadingState message={`Генерация ${label.toLowerCase()}...`} />
  }

  if (status === 'failed') {
    return (
      <ErrorState
        message={analysis.error_message ?? `Ошибка генерации ${label.toLowerCase()}`}
        onRetry={onGenerate}
      />
    )
  }

  return (
    <ScrollArea flex={1} offsetScrollbars>
      <AnalysisContent type={type} analysis={analysis} />
    </ScrollArea>
  )
}
