'use client'

import {
  Alert,
  Button,
  Card,
  Center,
  Divider,
  Group,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { IconAlertCircle, IconRefresh, IconSparkles } from '@tabler/icons-react'

import {
  useTrendIntelligenceQuery,
  useGenerateTrendIntelligenceMutation,
} from '@/api/hooks/useTrends'
import type { IntelligenceResponse } from '@/api/types/intelligence'
import {
  SummarySection,
  KeyPointsSection,
  TopicsSection,
  ContentIdeasSection,
  HooksSection,
  QualityScore,
  ToneBadge,
} from '@/components/features/content-intelligence/sections'

function IntelligenceSkeleton() {
  return (
    <Stack gap="md">
      <Skeleton height={20} width="40%" />
      <Skeleton height={80} />
      <Skeleton height={60} />
      <Skeleton height={40} />
    </Stack>
  )
}

function CompletedIntelligence({ data }: { data: IntelligenceResponse }) {
  return (
    <Stack gap="lg">
      {(data.tone || data.quality_score != null) && (
        <Group gap="lg">
          {data.tone && <ToneBadge tone={data.tone} />}
          {data.quality_score != null && <QualityScore score={data.quality_score} />}
        </Group>
      )}

      {data.summary && (
        <Stack gap="sm">
          <Title order={5} c="gray.2">Краткое описание</Title>
          <SummarySection summary={data.summary} />
        </Stack>
      )}

      {!!data.key_points?.length && (
        <Stack gap="sm">
          <Title order={5} c="gray.2">Ключевые тезисы</Title>
          <KeyPointsSection points={data.key_points} />
        </Stack>
      )}

      {!!data.hooks?.length && (
        <Stack gap="sm">
          <Title order={5} c="gray.2">Хуки</Title>
          <HooksSection hooks={data.hooks} />
        </Stack>
      )}

      {!!data.topics?.length && (
        <Stack gap="sm">
          <Title order={5} c="gray.2">Темы</Title>
          <TopicsSection topics={data.topics} />
        </Stack>
      )}

      {!!data.content_ideas?.length && (
        <Stack gap="sm">
          <Title order={5} c="gray.2">Идеи контента</Title>
          <ContentIdeasSection ideas={data.content_ideas} />
        </Stack>
      )}
    </Stack>
  )
}

interface TrendIntelligenceSectionProps {
  workspaceId: number
  trendItemId: number
}

export function TrendIntelligenceSection({
  workspaceId,
  trendItemId,
}: TrendIntelligenceSectionProps) {
  const { data, isLoading, isError, refetch } = useTrendIntelligenceQuery(workspaceId, trendItemId)
  const generateMutation = useGenerateTrendIntelligenceMutation(workspaceId)
  const isGenerating = generateMutation.isPending

  function handleGenerate(force = false) {
    generateMutation.mutate({ trendItemId, force })
  }

  if (isLoading) {
    return (
      <Card padding="lg" radius="md" bg="dark.6">
        <IntelligenceSkeleton />
      </Card>
    )
  }

  if (isError) {
    return (
      <Card padding="lg" radius="md" bg="dark.6">
        <Alert icon={<IconAlertCircle />} color="red" title="Ошибка">
          <Stack gap="sm">
            Не удалось загрузить AI-анализ
            <Button variant="light" color="red" size="xs" onClick={() => refetch()}>
              Повторить
            </Button>
          </Stack>
        </Alert>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card padding="lg" radius="md" bg="dark.6">
        <Center py="xl">
          <Stack align="center" gap="md">
            <IconSparkles size={32} style={{ color: 'var(--mantine-color-violet-5)' }} />
            <Text c="dimmed" size="sm">AI-анализ ещё не проводился</Text>
            <Button
              variant="light"
              color="violet"
              leftSection={<IconSparkles size={16} />}
              loading={isGenerating}
              onClick={() => handleGenerate()}
            >
              Сгенерировать AI-анализ
            </Button>
          </Stack>
        </Center>
      </Card>
    )
  }

  if (data.status === 'pending' || data.status === 'processing') {
    return (
      <Card padding="lg" radius="md" bg="dark.6">
        <Stack gap="md">
          <IntelligenceSkeleton />
          <Center>
            <Text c="dimmed" size="sm">Генерация анализа...</Text>
          </Center>
        </Stack>
      </Card>
    )
  }

  if (data.status === 'failed') {
    return (
      <Card padding="lg" radius="md" bg="dark.6">
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
      </Card>
    )
  }

  return (
    <Card padding="lg" radius="md" bg="dark.6">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <Title order={4} c="gray.1">AI-анализ тренда</Title>
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
        <CompletedIntelligence data={data} />
      </Stack>
    </Card>
  )
}
