'use client'

import { AspectRatio, Card, Center } from '@mantine/core'
import { IconPhoto } from '@tabler/icons-react'

import type { TrendPlatform } from '@/api/types/trend'

interface TrendEmbedPreviewProps {
  trend: {
    platform: TrendPlatform
    platform_post_id: string
    post_url: string | null
    thumbnail_url: string | null
  }
}

const VALID_ID_RE = /^[a-zA-Z0-9_-]+$/

export function TrendEmbedPreview({ trend }: TrendEmbedPreviewProps) {
  if (trend.platform === 'youtube') {
    const isValidId = VALID_ID_RE.test(trend.platform_post_id)

    if (!isValidId) {
      return (
        <Card padding={0} radius="md" bg="dark.6">
          <AspectRatio ratio={16 / 9}>
            <Center>
              <IconPhoto size={48} style={{ color: 'var(--mantine-color-dimmed)' }} />
            </Center>
          </AspectRatio>
        </Card>
      )
    }

    return (
      <Card padding={0} radius="md" bg="dark.6" style={{ overflow: 'hidden' }}>
        <AspectRatio ratio={16 / 9}>
          <iframe
            src={`https://www.youtube.com/embed/${trend.platform_post_id}`}
            title="YouTube video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ border: 0, width: '100%', height: '100%' }}
          />
        </AspectRatio>
      </Card>
    )
  }

  if (trend.platform === 'instagram' && trend.thumbnail_url) {
    return (
      <Card
        padding={0}
        radius="md"
        bg="dark.6"
        style={{ overflow: 'hidden', cursor: 'pointer' }}
        onClick={() => trend.post_url && window.open(trend.post_url, '_blank')}
      >
        <AspectRatio ratio={16 / 9}>
          <img
            src={trend.thumbnail_url}
            alt="Instagram preview"
            style={{ objectFit: 'cover', width: '100%', height: '100%' }}
          />
        </AspectRatio>
      </Card>
    )
  }

  return (
    <Card padding={0} radius="md" bg="dark.6">
      <AspectRatio ratio={16 / 9}>
        <Center>
          <IconPhoto size={48} style={{ color: 'var(--mantine-color-dimmed)' }} />
        </Center>
      </AspectRatio>
    </Card>
  )
}
