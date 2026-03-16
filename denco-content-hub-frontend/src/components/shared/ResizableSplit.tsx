'use client'

import { useCallback, useRef, useState, type ReactNode } from 'react'
import styles from './ResizableSplit.module.css'

interface ResizableSplitProps {
  left: ReactNode
  right: ReactNode
  defaultRatio?: number
  minWidth?: number
}

export function ResizableSplit({
  left,
  right,
  defaultRatio = 0.55,
  minWidth = 320,
}: ResizableSplitProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ratio, setRatio] = useState(defaultRatio)
  const [isDragging, setIsDragging] = useState(false)

  const clampRatio = useCallback(
    (clientX: number) => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const dividerWidth = 4
      const availableWidth = rect.width - dividerWidth
      const rawRatio = (clientX - rect.left) / rect.width
      const minRatio = minWidth / availableWidth
      const maxRatio = 1 - minRatio
      setRatio(Math.min(maxRatio, Math.max(minRatio, rawRatio)))
    },
    [minWidth],
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      setIsDragging(true)
      const target = e.currentTarget as HTMLElement
      target.setPointerCapture(e.pointerId)

      const onPointerMove = (ev: PointerEvent) => clampRatio(ev.clientX)
      const cleanup = () => {
        setIsDragging(false)
        target.removeEventListener('pointermove', onPointerMove)
        target.removeEventListener('pointerup', cleanup)
        target.removeEventListener('pointercancel', cleanup)
      }

      target.addEventListener('pointermove', onPointerMove)
      target.addEventListener('pointerup', cleanup)
      target.addEventListener('pointercancel', cleanup)
    },
    [clampRatio],
  )

  const dividerClass = isDragging
    ? `${styles.divider} ${styles.dividerActive}`
    : styles.divider

  const containerClass = isDragging
    ? `${styles.container} ${styles.dragging}`
    : styles.container

  return (
    <div ref={containerRef} className={containerClass}>
      <div
        className={styles.panel}
        style={{ width: `calc(${ratio * 100}% - 2px)` }}
      >
        {left}
      </div>
      <div
        className={dividerClass}
        onPointerDown={handlePointerDown}
        role="separator"
        aria-orientation="vertical"
      />
      <div
        className={styles.panel}
        style={{ width: `calc(${(1 - ratio) * 100}% - 2px)` }}
      >
        {right}
      </div>
    </div>
  )
}
