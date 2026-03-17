'use client'

import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Group,
  Text,
  Button,
  Center,
  Stack,
  Title,
  Skeleton,
} from '@mantine/core'
import { IconShare3 } from '@tabler/icons-react'

import type { KnowledgeNodeResponse, KnowledgeEdgeResponse } from '@/api/client/types.gen'
import { toFlowNodes, toFlowEdges } from '@/lib/knowledge-transform'

const PublicGraphCanvas = dynamic(
  () => import('./PublicGraphCanvas').then((m) => m.PublicGraphCanvas),
  { ssr: false, loading: () => <GraphLoadingSkeleton /> },
)

interface PublicKnowledgeGraphResponse {
  title: string
  nodes: KnowledgeNodeResponse[]
  edges: KnowledgeEdgeResponse[]
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8001'

async function fetchPublicGraph(token: string): Promise<PublicKnowledgeGraphResponse> {
  const res = await fetch(`${API_BASE}/api/v1/public/graph/${token}`)
  if (res.status === 404) {
    throw new NotFoundError()
  }
  if (!res.ok) {
    throw new Error(`Ошибка сервера: ${res.status}`)
  }
  return res.json() as Promise<PublicKnowledgeGraphResponse>
}

class NotFoundError extends Error {
  constructor() {
    super('not_found')
  }
}

function GraphLoadingSkeleton() {
  return (
    <Box style={{ flex: 1, padding: 20 }}>
      <Skeleton height="100%" radius={12} />
    </Box>
  )
}

function GraphUnavailable() {
  return (
    <Center style={{ flex: 1 }}>
      <Stack align="center" gap="md">
        <Box
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: 'rgba(255, 69, 58, 0.08)',
            border: '1.5px dashed rgba(255, 69, 58, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconShare3 size={28} color="var(--mantine-color-red-5)" />
        </Box>
        <Stack align="center" gap={6}>
          <Title order={3} c="var(--text-primary)">
            Граф недоступен
          </Title>
          <Text c="dimmed" size="sm" ta="center" maw={320}>
            Ссылка устарела или недействительна. Обратитесь к тому, кто её отправил.
          </Text>
        </Stack>
        <Button component="a" href="/login" variant="light" size="sm">
          Войти в DENCO
        </Button>
      </Stack>
    </Center>
  )
}

function GraphErrorState() {
  return (
    <Center style={{ flex: 1 }}>
      <Stack align="center" gap="md">
        <Text c="dimmed" size="sm">
          Не удалось загрузить граф. Попробуйте обновить страницу.
        </Text>
        <Button
          variant="light"
          size="sm"
          onClick={() => window.location.reload()}
        >
          Обновить
        </Button>
      </Stack>
    </Center>
  )
}

export default function PublicGraphPage() {
  const params = useParams()
  const token = params.token as string

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-graph', token],
    queryFn: () => fetchPublicGraph(token),
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  const { nodes, edges } = useMemo(() => {
    if (!data) return { nodes: [], edges: [] }
    const nodeMap = new Map(data.nodes.map((n) => [n.id, n]))
    return {
      nodes: toFlowNodes(data.nodes),
      edges: toFlowEdges(data.edges, nodeMap),
    }
  }, [data])

  const isNotFound = error instanceof NotFoundError

  return (
    <Box
      style={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--mantine-color-dark-8)',
      }}
    >
      {/* Шапка */}
      <Group
        justify="space-between"
        px={20}
        py={12}
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
          background: 'var(--mantine-color-dark-9)',
        }}
      >
        <Group gap={10}>
          <Text fw={800} size="md" c="var(--text-primary)" style={{ letterSpacing: -0.3 }}>
            DENCO
          </Text>
          {data?.title && (
            <>
              <Text c="var(--border-subtle)" size="md">|</Text>
              <Text size="sm" c="dimmed" lineClamp={1} maw={400}>
                {data.title}
              </Text>
            </>
          )}
          {isLoading && (
            <Skeleton height={16} width={180} radius={4} />
          )}
        </Group>
        <Button
          component="a"
          href="/login"
          variant="light"
          size="sm"
          radius="md"
        >
          Войти в DENCO
        </Button>
      </Group>

      {/* Тело */}
      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {isLoading && <GraphLoadingSkeleton />}
        {isNotFound && <GraphUnavailable />}
        {error && !isNotFound && <GraphErrorState />}
        {data && (
          <PublicGraphCanvas nodes={nodes} edges={edges} />
        )}
      </Box>
    </Box>
  )
}
