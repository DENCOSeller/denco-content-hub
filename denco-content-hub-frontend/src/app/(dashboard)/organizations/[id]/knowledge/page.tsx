'use client'

import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import { Stack } from '@mantine/core'

import { PageHeader } from '@denco/ui'
import { useOrganizationStore } from '@/stores/organization-store'
import { AppBreadcrumbs } from '@/components/shared/Breadcrumbs'
import { LoadingState } from '@/components/shared/LoadingState'
import { useSetAiPageContext } from '@/contexts/AiPageContext'

const KnowledgeGraph = dynamic(
  () => import('@/components/knowledge/KnowledgeGraph').then((m) => m.KnowledgeGraph),
  { ssr: false, loading: () => <LoadingState /> },
)

export default function OrganizationKnowledgePage() {
  const params = useParams()
  const organizationId = Number(params.id)
  const activeOrganization = useOrganizationStore((s) => s.activeOrganization)

  useSetAiPageContext({
    page_type: 'company_knowledge',
    company_id: organizationId,
  })

  const breadcrumbs = [
    { label: 'Организации', href: '/organizations' },
    { label: activeOrganization?.name ?? 'Организация', href: `/organizations/${organizationId}` },
    { label: 'Граф знаний' },
  ]

  return (
    <Stack gap="md">
      <AppBreadcrumbs items={breadcrumbs} />
      <PageHeader title="Граф знаний организации" subtitle="Визуализация связей и концепций" />
      <KnowledgeGraph scope="company" scopeId={organizationId} />
    </Stack>
  )
}
