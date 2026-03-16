'use client'

import { useRef, useCallback, useState, useImperativeHandle, forwardRef } from 'react'
import { IconSend, IconSquare, IconPaperclip } from '@tabler/icons-react'
import { ChatAttachmentChip } from './ChatAttachmentChip'
import { AiSlashCommands, getFilteredCommands } from './AiSlashCommands'
import type { SlashCommand } from './AiSlashCommands'
import styles from './AiChatInput.module.css'

export const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const ACCEPTED_EXTENSIONS = '.pdf,.png,.jpg,.jpeg,.webp,.docx'
const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_FILES = 3

export interface AttachedFile {
  file: File
  id: string
}

export interface AiChatInputHandle {
  addFiles: (files: File[]) => void
}

interface AiChatInputProps {
  onSend: (message: string, files: AttachedFile[]) => void
  onStop: () => void
  isStreaming: boolean
  disabled?: boolean
}

export const AiChatInput = forwardRef<AiChatInputHandle, AiChatInputProps>(function AiChatInput(
  { onSend, onStop, isStreaming, disabled },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [slashOpen, setSlashOpen] = useState(false)
  const [slashFilter, setSlashFilter] = useState('')
  const [slashActiveIndex, setSlashActiveIndex] = useState(0)

  const addFilesInternal = useCallback(
    (files: File[]) => {
      const newFiles: AttachedFile[] = []
      for (const file of files) {
        if (attachedFiles.length + newFiles.length >= MAX_FILES) break
        if (file.size > MAX_FILE_SIZE) continue
        if (!ACCEPTED_MIME_TYPES.includes(file.type)) continue
        newFiles.push({ file, id: `file-${Date.now()}-${Math.random().toString(36).slice(2)}` })
      }
      if (newFiles.length > 0) {
        setAttachedFiles((prev) => [...prev, ...newFiles].slice(0, MAX_FILES))
      }
    },
    [attachedFiles.length],
  )

  useImperativeHandle(ref, () => ({ addFiles: addFilesInternal }), [addFilesInternal])

  const handleSend = useCallback(() => {
    const value = textareaRef.current?.value.trim()
    if ((!value && attachedFiles.length === 0) || isStreaming) return
    onSend(value || '', attachedFiles)
    if (textareaRef.current) {
      textareaRef.current.value = ''
      textareaRef.current.style.height = 'auto'
    }
    setAttachedFiles([])
  }, [onSend, isStreaming, attachedFiles])

  const handleSlashSelect = useCallback(
    (cmd: SlashCommand) => {
      if (!textareaRef.current) return
      textareaRef.current.value = cmd.template
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
      setSlashOpen(false)
      setSlashFilter('')
      setSlashActiveIndex(0)
      textareaRef.current.focus()
    },
    [],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (slashOpen) {
        const filtered = getFilteredCommands(slashFilter)
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSlashActiveIndex((prev) => (prev + 1) % filtered.length)
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSlashActiveIndex((prev) => (prev - 1 + filtered.length) % filtered.length)
          return
        }
        if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
          e.preventDefault()
          if (filtered[slashActiveIndex]) {
            handleSlashSelect(filtered[slashActiveIndex])
          }
          return
        }
        if (e.key === 'Tab') {
          e.preventDefault()
          if (filtered[slashActiveIndex]) {
            handleSlashSelect(filtered[slashActiveIndex])
          }
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          setSlashOpen(false)
          setSlashFilter('')
          setSlashActiveIndex(0)
          return
        }
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend, slashOpen, slashFilter, slashActiveIndex, handleSlashSelect],
  )

  const handleInput = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`

    const value = el.value
    if (value.startsWith('/') && !value.includes(' ')) {
      setSlashOpen(true)
      setSlashFilter(value)
      setSlashActiveIndex(0)
    } else {
      if (slashOpen) {
        setSlashOpen(false)
        setSlashFilter('')
        setSlashActiveIndex(0)
      }
    }
  }, [slashOpen])

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files) return
      addFilesInternal(Array.from(files))
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [addFilesInternal],
  )

  const handleRemoveFile = useCallback((id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  return (
    <div className={styles.inputWrapper}>
      {slashOpen && (
        <AiSlashCommands
          filter={slashFilter}
          activeIndex={slashActiveIndex}
          onSelect={handleSlashSelect}
        />
      )}
      {attachedFiles.length > 0 && (
        <div className={styles.attachments}>
          {attachedFiles.map((af) => (
            <ChatAttachmentChip
              key={af.id}
              name={af.file.name}
              size={af.file.size}
              contentType={af.file.type}
              onRemove={() => handleRemoveFile(af.id)}
            />
          ))}
        </div>
      )}
      <div className={styles.inputContainer}>
        <button
          type="button"
          className={styles.attachButton}
          onClick={handleFileSelect}
          disabled={disabled || isStreaming || attachedFiles.length >= MAX_FILES}
          aria-label="Прикрепить файл"
        >
          <IconPaperclip size={16} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          multiple
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder="Напиши сообщение..."
          rows={1}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={disabled}
        />
        {isStreaming ? (
          <button
            type="button"
            className={styles.stopButton}
            onClick={onStop}
            aria-label="Остановить генерацию"
          >
            <IconSquare size={14} />
          </button>
        ) : (
          <button
            type="button"
            className={styles.sendButton}
            onClick={handleSend}
            disabled={disabled}
            aria-label="Отправить"
          >
            <IconSend size={16} />
          </button>
        )}
      </div>
      <div className={styles.hint}>Cmd+Enter — отправить</div>
    </div>
  )
})
