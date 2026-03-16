'use client'

import { Anchor, Breadcrumbs as MantineBreadcrumbs, Text } from '@mantine/core'
import Link from 'next/link'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface AppBreadcrumbsProps {
  items: BreadcrumbItem[]
}

export function AppBreadcrumbs({ items }: AppBreadcrumbsProps) {
  return (
    <MantineBreadcrumbs mb="md">
      {items.map((item, index) => {
        const isLast = index === items.length - 1

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
            {item.label}
          </Anchor>
        )
      })}
    </MantineBreadcrumbs>
  )
}
