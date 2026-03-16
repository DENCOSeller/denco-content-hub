'use client'

import { MantineProvider } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { theme } from '@/theme'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useCompanyStore } from '@/stores/company-store'

// Initialize API client and interceptors
import '@/api/instance'

export function AppProviders({ children }: { children: React.ReactNode }) {
  const hydrateWorkspace = useWorkspaceStore((s) => s.hydrateFromCookie)
  const hydrateCompany = useCompanyStore((s) => s.hydrateFromCookie)

  useEffect(() => {
    hydrateWorkspace()
    hydrateCompany()
  }, [hydrateWorkspace, hydrateCompany])

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="dark" forceColorScheme="dark">
        <ModalsProvider>
          <Notifications position="top-right" />
          {children}
        </ModalsProvider>
      </MantineProvider>
    </QueryClientProvider>
  )
}
