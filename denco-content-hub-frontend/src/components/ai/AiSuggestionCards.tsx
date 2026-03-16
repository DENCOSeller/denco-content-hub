'use client'

import { IconTarget, IconCalendar, IconSpeakerphone, IconPencil } from '@tabler/icons-react'
import styles from './AiSuggestionCards.module.css'

const suggestions = [
  {
    icon: IconTarget,
    text: 'Проанализируй мою целевую аудиторию',
  },
  {
    icon: IconCalendar,
    text: 'Предложи контент-план',
  },
  {
    icon: IconSpeakerphone,
    text: 'Какие каналы использовать?',
  },
  {
    icon: IconPencil,
    text: 'Помоги написать текст',
  },
] as const

interface AiSuggestionCardsProps {
  onSelect: (text: string) => void
}

export function AiSuggestionCards({ onSelect }: AiSuggestionCardsProps) {
  return (
    <div className={styles.grid}>
      {suggestions.map((s) => (
        <button
          key={s.text}
          type="button"
          className={styles.card}
          onClick={() => onSelect(s.text)}
        >
          <div className={styles.cardIcon}>
            <s.icon size={16} />
          </div>
          {s.text}
        </button>
      ))}
    </div>
  )
}
