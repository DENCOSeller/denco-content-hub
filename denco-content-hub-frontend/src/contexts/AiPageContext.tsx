'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'

export interface AiPageContext {
  page_type:
    | 'dashboard'
    | 'workspace'
    | 'workspace_knowledge'
    | 'company_knowledge'
    | 'content_item'
  workspace_id?: number
  company_id?: number
  workspace_name?: string
  content_item_id?: number
  focused_node_ids?: number[]
  current_node?: { id: number; title: string; type: string }
  selected_content_ids?: number[]
}

interface AiPageContextState {
  context: AiPageContext | null
  setContext: (ctx: AiPageContext | null) => void
}

const AiPageCtx = createContext<AiPageContextState | null>(null)

export function AiPageContextProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<AiPageContext | null>(null)

  return (
    <AiPageCtx.Provider value={{ context, setContext }}>
      {children}
    </AiPageCtx.Provider>
  )
}

/**
 * Sets the AI page context. Call from page components.
 * Automatically clears on unmount.
 */
export function useSetAiPageContext(ctx: AiPageContext) {
  const value = useContext(AiPageCtx)
  if (!value) {
    throw new Error('useSetAiPageContext must be used within AiPageContextProvider')
  }

  const { setContext } = value

  const stableKey = JSON.stringify(ctx)

  useEffect(() => {
    setContext(JSON.parse(stableKey) as AiPageContext)
    return () => setContext(null)
  }, [stableKey, setContext])
}

/**
 * Reads current AI page context (for the AI panel).
 */
export function useAiPageContext(): AiPageContext | null {
  const value = useContext(AiPageCtx)
  if (!value) {
    throw new Error('useAiPageContext must be used within AiPageContextProvider')
  }
  return value.context
}
