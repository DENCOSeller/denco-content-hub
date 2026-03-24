'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function TrendAlertsPage() {
  const params = useParams()
  const router = useRouter()
  const workspaceId = Number(params.id)

  useEffect(() => {
    router.replace(`/workspaces/${workspaceId}/trends?tab=alerts`)
  }, [router, workspaceId])

  return null
}
