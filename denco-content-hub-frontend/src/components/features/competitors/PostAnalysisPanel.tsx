'use client'

import { Card, Stack, Text, Group, Badge, Alert, Loader } from '@mantine/core'
import { IconSparkles, IconAlertCircle } from '@tabler/icons-react'

import { usePostAnalysisQuery } from '@/api/hooks/useCompetitors'

interface PostAnalysisPanelProps {
  postId: number
}

export function PostAnalysisPanel({ postId }: PostAnalysisPanelProps) {
  const { data: analysis, isLoading, isError } = usePostAnalysisQuery(postId)

  if (isLoading) {
    return (
      <Card withBorder padding="md" radius="md">
        <Group justify="center" p="md">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">Загрузка анализа...</Text>
        </Group>
      </Card>
    )
  }

  if (isError || !analysis) {
    return (
      <Alert
        variant="light"
        color="gray"
        icon={<IconAlertCircle size={16} />}
        title="Анализ недоступен"
      >
        AI-анализ для этого поста ещё не выполнен.
      </Alert>
    )
  }

  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="sm">
        <Group gap="xs">
          <IconSparkles size={16} color="var(--neon-blue)" />
          <Text fw={600} size="sm">AI-анализ</Text>
          {analysis.quality_score != null && (
            <Badge variant="light" size="xs">
              Качество: {analysis.quality_score}/10
            </Badge>
          )}
        </Group>

        {analysis.tone && (
          <Group gap="xs">
            <Text size="xs" fw={500} c="dimmed">Тональность:</Text>
            <Badge variant="light" size="xs">{analysis.tone}</Badge>
          </Group>
        )}

        {analysis.topics && analysis.topics.length > 0 && (
          <Stack gap={4}>
            <Text size="xs" fw={500} c="dimmed">Темы:</Text>
            <Group gap={4}>
              {analysis.topics.map((topic) => (
                <Badge key={topic} variant="outline" size="xs">{topic}</Badge>
              ))}
            </Group>
          </Stack>
        )}

        {analysis.summary && (
          <Stack gap={4}>
            <Text size="xs" fw={500} c="dimmed">Резюме:</Text>
            <Text size="sm">{analysis.summary}</Text>
          </Stack>
        )}

        {analysis.key_points && analysis.key_points.length > 0 && (
          <Stack gap={4}>
            <Text size="xs" fw={500} c="dimmed">Сильные стороны:</Text>
            <Stack gap={2}>
              {analysis.key_points.map((point, i) => (
                <Text key={i} size="sm">• {point}</Text>
              ))}
            </Stack>
          </Stack>
        )}

        {analysis.content_ideas && analysis.content_ideas.length > 0 && (
          <Stack gap={4}>
            <Text size="xs" fw={500} c="dimmed">Идеи для контента:</Text>
            <Stack gap={2}>
              {analysis.content_ideas.map((idea, i) => (
                <Text key={i} size="sm">
                  • {typeof idea === 'object' && idea !== null && 'title' in idea
                    ? String((idea as Record<string, unknown>).title)
                    : JSON.stringify(idea)}
                </Text>
              ))}
            </Stack>
          </Stack>
        )}
      </Stack>
    </Card>
  )
}
