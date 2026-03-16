'use client'

import { Tooltip } from '@mantine/core'
import { useRouter } from 'next/navigation'
import { getNodeTypeConfig, type NodeType } from '@/lib/knowledge-utils'
import styles from './NodeReference.module.css'

interface NodeReferenceProps {
  id: number
  nodeType: NodeType
  title: string
  workspaceId?: string | number
  companyId?: string | number
}

export function NodeReference({ id, nodeType, title, workspaceId, companyId }: NodeReferenceProps) {
  const router = useRouter()
  const config = getNodeTypeConfig(nodeType)
  const Icon = config.icon

  const handleClick = () => {
    if (workspaceId) {
      router.push(`/workspaces/${workspaceId}/knowledge?focusNode=${id}`)
    } else if (companyId) {
      router.push(`/companies/${companyId}/knowledge?focusNode=${id}`)
    }
  }

  return (
    <Tooltip label="Перейти к узлу" withArrow>
      <button
        type="button"
        className={styles.badge}
        style={{ '--node-color': config.color } as React.CSSProperties}
        onClick={handleClick}
      >
        <Icon size={13} className={styles.icon} />
        <span className={styles.title}>{title}</span>
      </button>
    </Tooltip>
  )
}
