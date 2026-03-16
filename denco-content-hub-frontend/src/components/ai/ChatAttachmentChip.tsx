'use client'

import { IconFile, IconFileTypePdf, IconFileTypeDocx, IconPhoto, IconX } from '@tabler/icons-react'
import styles from './ChatAttachmentChip.module.css'

interface ChatAttachmentChipProps {
  name: string
  size: number
  contentType: string
  onRemove?: () => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(contentType: string) {
  if (contentType === 'application/pdf') return <IconFileTypePdf size={14} />
  if (contentType.startsWith('image/')) return <IconPhoto size={14} />
  if (contentType.includes('wordprocessingml') || contentType === 'application/msword')
    return <IconFileTypeDocx size={14} />
  return <IconFile size={14} />
}

export function ChatAttachmentChip({ name, size, contentType, onRemove }: ChatAttachmentChipProps) {
  return (
    <div className={styles.chip}>
      <span className={styles.icon}>{getFileIcon(contentType)}</span>
      <span className={styles.name} title={name}>
        {name.length > 20 ? `${name.slice(0, 17)}...` : name}
      </span>
      <span className={styles.size}>{formatSize(size)}</span>
      {onRemove && (
        <button type="button" className={styles.remove} onClick={onRemove} aria-label="Удалить файл">
          <IconX size={12} />
        </button>
      )}
    </div>
  )
}
