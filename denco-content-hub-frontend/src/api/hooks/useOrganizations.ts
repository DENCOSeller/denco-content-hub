'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listOrganizationsApiV1PlatformOrganizationsGet,
  getOrganizationApiV1PlatformOrganizationsOrganizationIdGet,
  createOrganizationApiV1PlatformOrganizationsPost,
  updateOrganizationApiV1PlatformOrganizationsOrganizationIdPatch,
  deleteOrganizationApiV1PlatformOrganizationsOrganizationIdDelete,
} from '@/api/client'
import type { OrganizationCreate, OrganizationUpdate } from '@/api/client/types.gen'
import { useAuthStore } from '@/stores/auth-store'

export function useOrganizationsQuery(page = 1, size = 20, search?: string) {
  const user = useAuthStore((s) => s.user)
  return useQuery({
    queryKey: ['organizations', { page, size, search }],
    queryFn: async () => {
      const result = await listOrganizationsApiV1PlatformOrganizationsGet({
        query: { page, size, search: search || undefined },
        throwOnError: true,
      })
      return result.data
    },
    enabled: !!user?.is_platform_owner,
  })
}

export function useOrganizationDetailQuery(organizationId: number) {
  const user = useAuthStore((s) => s.user)
  return useQuery({
    queryKey: ['organizations', organizationId],
    queryFn: async () => {
      const result = await getOrganizationApiV1PlatformOrganizationsOrganizationIdGet({
        path: { organization_id: organizationId },
        throwOnError: true,
      })
      return result.data
    },
    enabled: !!user?.is_platform_owner && organizationId > 0,
  })
}

export function useCreateOrganizationMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: OrganizationCreate) => {
      const result = await createOrganizationApiV1PlatformOrganizationsPost({
        body: data,
        throwOnError: true,
      })
      return result.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizations'] })
    },
  })
}

export function useUpdateOrganizationMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      organizationId,
      data,
    }: {
      organizationId: number
      data: OrganizationUpdate
    }) => {
      const result = await updateOrganizationApiV1PlatformOrganizationsOrganizationIdPatch({
        path: { organization_id: organizationId },
        body: data,
        throwOnError: true,
      })
      return result.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizations'] })
    },
  })
}

export function useDeleteOrganizationMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (organizationId: number) =>
      deleteOrganizationApiV1PlatformOrganizationsOrganizationIdDelete({
        path: { organization_id: organizationId },
        throwOnError: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizations'] })
    },
  })
}
