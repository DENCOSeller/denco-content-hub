'use client'

import { useMemo } from 'react'

import { useNodeTypeDefs } from '@/api/hooks/useKgTypes'
import {
  NODE_TYPE_CONFIG,
  buildNodeTypeConfig,
  mergeNodeTypeConfig,
  buildNodeTypeOptions,
  getNodeTypeConfig as getNodeTypeConfigUtil,
  type NodeTypeConfig,
} from '@/lib/knowledge-utils'

interface UseNodeTypeConfigResult {
  /** Полный конфиг: API-данные поверх fallback */
  config: Record<string, NodeTypeConfig>
  /** Опции для Select (value/label) */
  typeOptions: Array<{ value: string; label: string }>
  /** Получить конфиг конкретного типа с fallback */
  getConfig: (nodeType: string) => NodeTypeConfig
  /** Получить node_type_def_id по slug */
  getTypeDefId: (slug: string) => number | undefined
  /** Данные из API загружены */
  isReady: boolean
  /** Идёт загрузка из API */
  isLoading: boolean
}

export function useNodeTypeConfig(companyId: number): UseNodeTypeConfigResult {
  const { data: apiTypes, isLoading } = useNodeTypeDefs(companyId)

  const apiConfig = useMemo(
    () => (apiTypes ? buildNodeTypeConfig(apiTypes) : undefined),
    [apiTypes],
  )

  const config = useMemo(() => mergeNodeTypeConfig(apiConfig), [apiConfig])

  const typeOptions = useMemo(() => buildNodeTypeOptions(config), [config])

  const getConfig = useMemo(
    () => (nodeType: string) => getNodeTypeConfigUtil(nodeType, config),
    [config],
  )

  const getTypeDefId = useMemo(
    () => (slug: string) => apiTypes?.find((t) => t.slug === slug)?.id,
    [apiTypes],
  )

  return {
    config,
    typeOptions,
    getConfig,
    getTypeDefId,
    isReady: !!apiTypes,
    isLoading,
  }
}

const FALLBACK_OPTIONS = buildNodeTypeOptions(NODE_TYPE_CONFIG)
const fallbackGetConfig = (nodeType: string) => getNodeTypeConfigUtil(nodeType)

/** Fallback для случаев когда companyId недоступен */
export function useNodeTypeConfigFallback(): UseNodeTypeConfigResult {
  return {
    config: NODE_TYPE_CONFIG as Record<string, NodeTypeConfig>,
    typeOptions: FALLBACK_OPTIONS,
    getConfig: fallbackGetConfig,
    getTypeDefId: () => undefined,
    isReady: true,
    isLoading: false,
  }
}
