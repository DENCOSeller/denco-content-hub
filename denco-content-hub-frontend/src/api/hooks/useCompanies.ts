'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listCompaniesApiV1PlatformCompaniesGet,
  getCompanyApiV1PlatformCompaniesCompanyIdGet,
  createCompanyApiV1PlatformCompaniesPost,
  updateCompanyApiV1PlatformCompaniesCompanyIdPatch,
  deleteCompanyApiV1PlatformCompaniesCompanyIdDelete,
} from '@/api/client'
import type { CompanyCreate, CompanyUpdate } from '@/api/client/types.gen'
import { useAuthStore } from '@/stores/auth-store'

export function useCompaniesQuery(page = 1, size = 20, search?: string) {
  const user = useAuthStore((s) => s.user)
  return useQuery({
    queryKey: ['companies', { page, size, search }],
    queryFn: async () => {
      const result = await listCompaniesApiV1PlatformCompaniesGet({
        query: { page, size, search: search || undefined },
        throwOnError: true,
      })
      return result.data
    },
    enabled: !!user?.is_platform_owner,
  })
}

export function useCompanyDetailQuery(companyId: number) {
  const user = useAuthStore((s) => s.user)
  return useQuery({
    queryKey: ['companies', companyId],
    queryFn: async () => {
      const result = await getCompanyApiV1PlatformCompaniesCompanyIdGet({
        path: { company_id: companyId },
        throwOnError: true,
      })
      return result.data
    },
    enabled: !!user?.is_platform_owner && companyId > 0,
  })
}

export function useCreateCompanyMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: CompanyCreate) => {
      const result = await createCompanyApiV1PlatformCompaniesPost({
        body: data,
        throwOnError: true,
      })
      return result.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] })
    },
  })
}

export function useUpdateCompanyMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      companyId,
      data,
    }: {
      companyId: number
      data: CompanyUpdate
    }) => {
      const result = await updateCompanyApiV1PlatformCompaniesCompanyIdPatch({
        path: { company_id: companyId },
        body: data,
        throwOnError: true,
      })
      return result.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] })
    },
  })
}

export function useDeleteCompanyMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (companyId: number) =>
      deleteCompanyApiV1PlatformCompaniesCompanyIdDelete({
        path: { company_id: companyId },
        throwOnError: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] })
    },
  })
}
