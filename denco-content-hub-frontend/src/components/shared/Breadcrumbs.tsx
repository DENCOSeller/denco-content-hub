'use client'

import { Anchor, Breadcrumbs as MantineBreadcrumbs, Text } from '@mantine/core'
import { IconHome } from '@tabler/icons-react'
import Link from 'next/link'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface AppBreadcrumbsProps {
  items: BreadcrumbItem[]
}

export function AppBreadcrumbs({ items }: AppBreadcrumbsProps) {
  const allItems: BreadcrumbItem[] = [
    { label: 'Content Hub', href: '/dashboard' },
    ...items,
  ]

  return (
    <MantineBreadcrumbs mb="md">
      {allItems.map((item, index) => {
        const isLast = index === allItems.length - 1
        const isFirst = index === 0

        if (isLast || !item.href) {
          return (
            <Text key={index} size="sm" c="dimmed" truncate maw={200}>
              {item.label}
            </Text>
          )
        }

        return (
          <Anchor
            key={index}
            component={Link}
            href={item.href}
            size="sm"
            truncate
            maw={200}
          >
            {isFirst ? <IconHome size={14} style={{ verticalAlign: 'middle' }} /> : item.label}
          </Anchor>
        )
      })}
    </MantineBreadcrumbs>
  )
}
