import {
  IconBrandYoutube,
  IconBrandTelegram,
  IconBrandInstagram,
  IconMessage,
} from '@tabler/icons-react'

import type { CompetitorPlatform } from '@/api/types/competitor'

export const platformConfig: Record<CompetitorPlatform, { icon: typeof IconBrandYoutube; label: string; color: string }> = {
  youtube: { icon: IconBrandYoutube, label: 'YouTube', color: 'red' },
  telegram: { icon: IconBrandTelegram, label: 'Telegram', color: 'blue' },
  instagram: { icon: IconBrandInstagram, label: 'Instagram', color: 'grape' },
  vk: { icon: IconMessage, label: 'VK', color: 'indigo' },
}
