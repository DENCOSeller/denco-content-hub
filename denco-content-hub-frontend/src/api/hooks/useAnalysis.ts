'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getAnalysisApi,
  generateAnalysisApi,
} from '@/api/analysis'

const ANALYSIS_ACTIVE_STATUSES = ['pending', 'processing']

export function useAnalysisQuery(workspaceId: number, contentId: number) {
  return useQuery({
    queryKey: ['analysis', workspaceId, contentId],
    queryFn: () => getAnalysisApi(workspaceId, contentId),
    enabled: !!workspaceId && !!contentId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (!status) return false
      return ANALYSIS_ACTIVE_STATUSES.includes(status) ? 3000 : false
    },
  })
}

export function useGenerateAnalysisMutation(workspaceId: number, contentId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (forceRegenerate?: boolean) => {
      return generateAnalysisApi(workspaceId, contentId, forceRegenerate)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['analysis', workspaceId, contentId] })
    },
  })
}
