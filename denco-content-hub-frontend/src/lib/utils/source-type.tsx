import {
  IconBrandYoutube,
  IconFileTypePdf,
  IconWorld,
  IconFileText,
} from '@tabler/icons-react'
import type { ReactNode } from 'react'

export type SourceType = 'youtube_video' | 'pdf_file' | 'web_page' | 'manual_text'

interface SourceTypeInfo {
  label: string
  icon: (size: number) => ReactNode
  color: string
  transcriptionLabel: string
}

const SOURCE_TYPE_MAP: Record<SourceType, SourceTypeInfo> = {
  youtube_video: {
    label: 'YouTube',
    icon: (size) => <IconBrandYoutube size={size} color="var(--mantine-color-red-6)" />,
    color: 'red',
    transcriptionLabel: 'Транскрипция',
  },
  pdf_file: {
    label: 'PDF',
    icon: (size) => <IconFileTypePdf size={size} color="var(--mantine-color-orange-6)" />,
    color: 'orange',
    transcriptionLabel: 'Извлечённый текст',
  },
  web_page: {
    label: 'Веб-страница',
    icon: (size) => <IconWorld size={size} color="var(--mantine-color-blue-6)" />,
    color: 'blue',
    transcriptionLabel: 'Извлечённый текст',
  },
  manual_text: {
    label: 'Текст',
    icon: (size) => <IconFileText size={size} color="var(--mantine-color-gray-6)" />,
    color: 'gray',
    transcriptionLabel: 'Извлечённый текст',
  },
}

export function getSourceType(sourceType: string | undefined | null): SourceType {
  if (sourceType && sourceType in SOURCE_TYPE_MAP) {
    return sourceType as SourceType
  }
  return 'youtube_video'
}

export function getSourceTypeInfo(sourceType: string | undefined | null): SourceTypeInfo {
  return SOURCE_TYPE_MAP[getSourceType(sourceType)]
}
