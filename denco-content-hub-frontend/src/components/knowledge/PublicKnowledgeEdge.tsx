'use client'

import { memo, useState } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react'

import type { KnowledgeEdgeData } from '@/lib/knowledge-transform'

interface PublicKnowledgeEdgeProps extends EdgeProps {
  data: KnowledgeEdgeData
}

function PublicKnowledgeEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: PublicKnowledgeEdgeProps) {
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
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

export const PublicKnowledgeEdge = memo(PublicKnowledgeEdgeComponent)
