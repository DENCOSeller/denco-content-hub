'use client'

import {
  Alert,
  Button,
  Center,
  Divider,
  Group,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconPlayerSkipForward,
  IconRefresh,
  IconSparkles,
} from '@tabler/icons-react'

import {
  useContentIntelligenceQuery,
  useCompetitorPostIntelligenceQuery,
  useGenerateContentIntelligenceMutation,
  useGenerateCompetitorIntelligenceMutation,
} from '@/api/hooks/useIntelligence'
import type { IntelligenceResponse } from '@/api/types/intelligence'

import {
  AudienceInsightsSection,
  ContentIdeasSection,
  ContentStructureSection,
  HooksSection,
  KeyPointsSection,
  ProductionNotesSection,
  QualityScore,
  StoryboardSection,
  SummarySection,
  ToneBadge,
  TopicsSection,
} from './sections'

// ─── Props ───────────────────────────────────────────────────────────────────

interface ContentIntelligencePanelProps {
  sourceType: 'reference' | 'competitor_post'
  sourceId: number
  workspaceId: number
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

function PanelSkeleton() {
  return (
    <Stack gap="md" p="md">
      <Skeleton height={20} width="40%" />
      <Skeleton height={80} />
      <Skeleton height={20} width="30%" />
      <Skeleton height={60} />
      <Skeleton height={60} />
      <Skeleton height={20} width="35%" />
      <Skeleton height={40} />
    </Stack>
  )
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Stack gap="sm">
      <Title order={5} c="gray.2">{title}</Title>
      {children}
    </Stack>
  )
}

// ─── Completed view ──────────────────────────────────────────────────────────

function CompletedSections({ data }: { data: IntelligenceResponse }) {
  return (
    <Stack gap="lg">
      {(data.tone || data.quality_score != null) && (
        <Group gap="lg">
          {data.tone && <ToneBadge tone={data.tone} />}
          {data.quality_score != null && <QualityScore score={data.quality_score} />}
        </Group>
      )}

      {data.summary && (
        <Section title="Краткое описание">
          <SummarySection summary={data.summary} />
        </Section>
      )}

      {!!data.key_points?.length && (
        <Section title="Ключевые тезисы">
          <KeyPointsSection points={data.key_points} />
        </Section>
      )}

      {!!data.hooks?.length && (
        <Section title="Хуки">
          <HooksSection hooks={data.hooks} />
        </Section>
      )}

      {!!data.topics?.length && (
        <Section title="Темы">
          <TopicsSection topics={data.topics} />
        </Section>
      )}

      {!!data.content_ideas?.length && (
        <Section title="Идеи контента">
          <ContentIdeasSection ideas={data.content_ideas} />
        </Section>
      )}

      {data.content_structure && (
        <Section title="Структура контента">
          <ContentStructureSection structure={data.content_structure} />
        </Section>
      )}

      {!!data.storyboard?.length && (
        <Section title="Сторибоард">
          <StoryboardSection storyboard={data.storyboard} />
        </Section>
      )}

      {!!data.audience_insights?.length && (
        <Section title="Аудитория">
          <AudienceInsightsSection insights={data.audience_insights} />
        </Section>
      )}

      {!!data.production_notes?.length && (
        <Section title="Заметки по продакшену">
          <ProductionNotesSection notes={data.production_notes} />
        </Section>
      )}
    </Stack>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function ContentIntelligencePanel({
  sourceType,
  sourceId,
  workspaceId,
}: ContentIntelligencePanelProps) {
  const isReference = sourceType === 'reference'

  const contentQuery = useContentIntelligenceQuery(
    workspaceId,
    isReference ? sourceId : 0,
  )
  const competitorQuery = useCompetitorPostIntelligenceQuery(
    workspaceId,
    isReference ? 0 : sourceId,
  )

  const query = isReference ? contentQuery : competitorQuery

  const contentMutation = useGenerateContentIntelligenceMutation(workspaceId)
  const competitorMutation = useGenerateCompetitorIntelligenceMutation(workspaceId)

  const { data, isLoading, isError, refetch } = query
  const mutation = isReference ? contentMutation : competitorMutation
  const isGenerating = mutation.isPending

  function handleGenerate(force = false) {
    if (isReference) {
      contentMutation.mutate({ contentId: sourceId, force })
    } else {
      competitorMutation.mutate({ postId: sourceId, force })
    }
  }

  // ── Loading ──
  if (isLoading) {
    return <PanelSkeleton />
  }

  // ── Error ──
  if (isError) {
    return (
      <Stack p="md">
        <Alert icon={<IconAlertCircle />} color="red" title="Ошибка">
          <Stack gap="sm">
            Не удалось загрузить анализ контента
            <Button variant="light" color="red" size="xs" onClick={() => refetch()}>
              Повторить
            </Button>
          </Stack>
        </Alert>
      </Stack>
    )
  }

  const status = data?.status

  // ── No data yet ──
  if (!data || (!status && !data)) {
    return (
      <Center py="xl" flex={1}>
        <Stack align="center" gap="md">
          <Text c="dimmed" size="sm">
            AI-анализ ещё не проводился
          </Text>
          <Button
            variant="light"
            leftSection={<IconSparkles size={16} />}
            loading={isGenerating}
            onClick={() => handleGenerate()}
          >
            Сгенерировать анализ
          </Button>
        </Stack>
      </Center>
    )
  }

  // ── Processing / Pending ──
  if (status === 'pending' || status === 'processing') {
    return (
      <Stack p="md" gap="md">
        <PanelSkeleton />
        <Center>
          <Text c="dimmed" size="sm">
            Генерация анализа...
          </Text>
        </Center>
      </Stack>
    )
  }

  // ── Failed ──
  if (status === 'failed') {
    return (
      <Stack p="md">
        <Alert icon={<IconAlertCircle />} color="red" title="Ошибка генерации">
          <Stack gap="sm">
            {data.error_message ?? 'Произошла ошибка при генерации анализа'}
            <Button
              variant="light"
              color="red"
              size="xs"
              leftSection={<IconRefresh size={14} />}
              loading={isGenerating}
              onClick={() => handleGenerate(true)}
            >
              Повторить
            </Button>
          </Stack>
        </Alert>
      </Stack>
    )
  }

  // ── Skipped ──
  if (status === 'skipped') {
    return (
      <Center py="xl" flex={1}>
        <Stack align="center" gap="md">
          <IconPlayerSkipForward size={32} color="gray" />
          <Text c="dimmed" size="sm" ta="center">
            Анализ пропущен — контент слишком короткий
          </Text>
        </Stack>
      </Center>
    )
  }

  // ── Completed ──
  return (
    <ScrollArea flex={1} offsetScrollbars>
      <Stack p="md" gap="lg">
        <Group justify="space-between" align="center">
          <Title order={4} c="gray.1">Content Intelligence</Title>
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconRefresh size={14} />}
            loading={isGenerating}
            onClick={() => handleGenerate(true)}
          >
            Перегенерировать
          </Button>
        </Group>

        <Divider color="dark.5" />

        <CompletedSections data={data} />
      </Stack>
    </ScrollArea>
  )
}
