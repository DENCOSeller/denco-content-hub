'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function TrendNichesPage() {
  const params = useParams()
  const router = useRouter()
  const workspaceId = Number(params.id)

  useEffect(() => {
    router.replace(`/workspaces/${workspaceId}/trends?tab=niches`)
  }, [router, workspaceId])

  return null
}
