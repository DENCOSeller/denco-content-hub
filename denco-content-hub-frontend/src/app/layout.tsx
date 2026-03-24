import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@denco/ui/styles/variables.css'
import './globals.css'

import type { Metadata } from 'next'
import { ColorSchemeScript } from '@mantine/core'

import { AppProviders } from '@/components/providers/AppProviders'

export const metadata: Metadata = {
  title: 'DENCO Content Hub',
  description: 'Content management platform',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="dark" forceColorScheme="dark" />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
