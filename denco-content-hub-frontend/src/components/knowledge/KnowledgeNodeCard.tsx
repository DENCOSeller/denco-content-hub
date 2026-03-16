'use client'

import { memo, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Text, Group, Box, Stack, ActionIcon } from '@mantine/core'
import { IconLock, IconPin, IconPinFilled } from '@tabler/icons-react'
import { getNodeTypeConfig } from '@/lib/knowledge-utils'
import styles from './KnowledgeNodeCard.module.css'
import type { KnowledgeNodeData } from '@/lib/knowledge-transform'

const HANDLE_STYLE = {
  width: 8,
  height: 8,
  background: 'var(--border-subtle)',
  border: '2px solid var(--card-bg)',
  transition: 'all 0.15s ease',
}

function KnowledgeNodeCardComponent({ data, selected }: NodeProps & { data: KnowledgeNodeData }) {
  const config = getNodeTypeConfig(data.nodeType)
  const Icon = config.icon
  const [hovered, setHovered] = useState(false)
  const isPinned = data.isPinned

  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    data.onTogglePin?.()
  }

  return (
    <>
      <Handle type="target" position={Position.Top} style={HANDLE_STYLE} />
      <Box
          className={`${styles.cardAppear} knowledge-node-card`}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            width: 260,
            position: 'relative',
            background: 'var(--card-bg)',
            border: selected
              ? `1.5px solid ${data.color}`
              : isPinned
                ? `1.5px dashed ${data.color}66`
                : data.isCompanyNode
                  ? `1.5px dashed ${data.color}44`
                  : `1px solid ${data.color}22`,
            borderRadius: 10,
            padding: '12px 14px',
            cursor: 'grab',
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            boxShadow: selected
              ? `0 0 0 1px ${data.color}33, 0 4px 12px rgba(0,0,0,0.3)`
              : '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          {(hovered || isPinned) && (
            <ActionIcon
              size={20}
              variant="subtle"
              onClick={handlePinClick}
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                opacity: isPinned ? 0.8 : 0.5,
                transition: 'opacity 0.15s ease',
              }}
            >
              {isPinned ? (
                <IconPinFilled size={12} color={data.color} />
              ) : (
                <IconPin size={12} color="var(--text-muted)" />
              )}
            </ActionIcon>
          )}
          <Stack gap={6}>
            <Group gap={8} wrap="nowrap" justify="space-between">
              <Group gap={8} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                <Box
                  style={{
                    background: data.gradient,
                    borderRadius: 6,
                    width: 26,
                    height: 26,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={14} color="#fff" />
                </Box>
                <Text
                  size="sm"
                  fw={600}
                  c="var(--text-primary)"
                  lineClamp={1}
                  style={{ lineHeight: 1.3 }}
                >
                  {data.title}
                </Text>
              </Group>
              {data.isCompanyNode && (
                <IconLock size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              )}
            </Group>
            {data.contentPreview && (
              <Text size="xs" c="var(--text-muted)" lineClamp={2} style={{ lineHeight: 1.4 }}>
                {data.contentPreview}
              </Text>
            )}
          </Stack>
        </Box>
      <Handle type="source" position={Position.Bottom} style={HANDLE_STYLE} />
    </>
  )
}

export const KnowledgeNodeCard = memo(KnowledgeNodeCardComponent)
