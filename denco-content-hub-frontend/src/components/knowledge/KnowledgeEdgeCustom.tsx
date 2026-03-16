'use client'

import { memo, useState } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react'
import { ActionIcon } from '@mantine/core'
import { IconX } from '@tabler/icons-react'

import type { KnowledgeEdgeData } from '@/lib/knowledge-transform'
import { useDeleteEdgeMutation } from '@/api/hooks/useKnowledge'

interface KnowledgeEdgeProps extends EdgeProps {
  data: KnowledgeEdgeData
}

function KnowledgeEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: KnowledgeEdgeProps) {
  const [hovered, setHovered] = useState(false)
  const isActive = selected || hovered

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  const strokeColor = isActive ? data.sourceColor : `${data.sourceColor}99`

  return (
    <>
      {/* Invisible wider path for easier hover */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth: isActive ? 2.5 : 2,
          transition: 'stroke 0.15s ease, stroke-width 0.15s ease',
        }}
      />
      <EdgeLabelRenderer>
        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <div
            style={{
              background: 'var(--card-bg)',
              border: `1px solid ${isActive ? data.sourceColor + '55' : 'var(--border-subtle)'}`,
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 11,
              color: isActive ? data.sourceColor : 'var(--text-muted)',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            {data.label}
          </div>
          {hovered && (
            <EdgeDeleteButton edgeId={data.edgeId} />
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

function EdgeDeleteButton({ edgeId }: { edgeId: number }) {
  // workspaceId will be injected via context in future; for now extract from URL
  const workspaceId = getWorkspaceIdFromUrl()
  const deleteMutation = useDeleteEdgeMutation(workspaceId)

  return (
    <ActionIcon
      size={18}
      variant="filled"
      color="red"
      radius="xl"
      onClick={(e) => {
        e.stopPropagation()
        deleteMutation.mutate(edgeId)
      }}
      style={{ opacity: 0.9 }}
    >
      <IconX size={10} />
    </ActionIcon>
  )
}

function getWorkspaceIdFromUrl(): number {
  if (typeof window === 'undefined') return 0
  const match = window.location.pathname.match(/\/workspaces\/(\d+)/)
  return match ? Number(match[1]) : 0
}

export const KnowledgeEdgeCustom = memo(KnowledgeEdgeComponent)
