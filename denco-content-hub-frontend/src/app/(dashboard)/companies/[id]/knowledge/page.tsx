'use client'

import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import { Stack, Title } from '@mantine/core'

import { useCompanyStore } from '@/stores/company-store'
import { AppBreadcrumbs } from '@/components/shared/Breadcrumbs'
import { LoadingState } from '@/components/shared/LoadingState'
import { useSetAiPageContext } from '@/contexts/AiPageContext'

const KnowledgeGraph = dynamic(
  () => import('@/components/knowledge/KnowledgeGraph').then((m) => m.KnowledgeGraph),
  { ssr: false, loading: () => <LoadingState /> },
)

export default function CompanyKnowledgePage() {
  const params = useParams()
  const companyId = Number(params.id)
  const activeCompany = useCompanyStore((s) => s.activeCompany)

  useSetAiPageContext({
    page_type: 'company_knowledge',
    company_id: companyId,
  })

  const breadcrumbs = [
    { label: 'Компании', href: '/companies' },
    { label: activeCompany?.name ?? 'Компания', href: `/companies/${companyId}` },
    { label: 'Граф знаний' },
  ]

  return (
    <Stack gap="md">
      <AppBreadcrumbs items={breadcrumbs} />
      <Title order={2}>Граф знаний компании</Title>
      <KnowledgeGraph scope="company" scopeId={companyId} />
    </Stack>
  )
}
