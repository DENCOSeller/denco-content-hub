'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { TextInput } from '@mantine/core'
import { IconArrowLeft, IconHistory, IconX } from '@tabler/icons-react'
import styles from './EditorToolbar.module.css'

type SaveState = 'saved' | 'saving' | 'dirty' | 'idle'

interface EditorToolbarProps {
  title: string
  isNavigated: boolean
  saveState: SaveState
  onBack: () => void
  onTitleChange: (newTitle: string) => void
  onHistoryClick: () => void
  onClose: () => void
}

export function EditorToolbar({
  title,
  isNavigated,
  saveState,
  onBack,
  onTitleChange,
  onHistoryClick,
  onClose,
}: EditorToolbarProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isEditing) setEditValue(title)
  }, [title, isEditing])

  useEffect(() => {
    if (isEditing) inputRef.current?.select()
  }, [isEditing])

  const handleStartEdit = useCallback(() => {
    setEditValue(title)
    setIsEditing(true)
  }, [title])

  const handleConfirm = useCallback(() => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== title) {
      onTitleChange(trimmed)
    }
    setIsEditing(false)
  }, [editValue, title, onTitleChange])

  const handleCancel = useCallback(() => {
    setEditValue(title)
    setIsEditing(false)
  }, [title])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleConfirm()
      if (e.key === 'Escape') handleCancel()
    },
    [handleConfirm, handleCancel],
  )

  const indicatorClass = {
    saved: styles.indicatorSaved,
    saving: styles.indicatorSaving,
    dirty: styles.indicatorDirty,
    idle: styles.indicatorIdle,
  }[saveState]

  const isDirty = saveState === 'dirty'

  return (
    <div className={styles.toolbar}>
      {isNavigated && (
        <button
          type="button"
          className={styles.backButton}
          onClick={onBack}
          aria-label="Назад"
        >
          <IconArrowLeft size={18} stroke={1.5} />
        </button>
      )}

      <div className={styles.titleWrapper}>
        {isEditing ? (
          <TextInput
            ref={inputRef}
            className={styles.titleInput}
            value={editValue}
            onChange={(e) => setEditValue(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleConfirm}
            variant="unstyled"
            size="sm"
          />
        ) : (
          <div
            className={styles.titleText}
            onClick={handleStartEdit}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleStartEdit()
            }}
          >
            {title}
          </div>
        )}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.ghostButton}
          onClick={onHistoryClick}
          aria-label="История"
        >
          <IconHistory size={18} stroke={1.5} />
        </button>

        <div className={styles.saveGroup} title={isDirty ? 'Не сохранено' : 'Сохранено'}>
          <div className={`${styles.saveIndicator} ${indicatorClass}`} />
        </div>

        <div className={styles.divider} />

        <button
          type="button"
          className={styles.ghostButton}
          onClick={onClose}
          aria-label="Закрыть"
        >
          <IconX size={18} stroke={1.5} />
        </button>
      </div>
    </div>
  )
}
