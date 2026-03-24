import { useEffect } from 'react'
import { create } from 'zustand'

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

interface AiPageState {
  context: AiPageContext | null
  setContext: (ctx: AiPageContext | null) => void
}

export const useAiPageStore = create<AiPageState>()((set) => ({
  context: null,
  setContext: (ctx) => set({ context: ctx }),
}))

/**
 * Sets the AI page context. Call from page components.
 * Automatically clears on unmount.
 */
export function useSetAiPageContext(ctx: AiPageContext) {
  const setContext = useAiPageStore((s) => s.setContext)
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
  return useAiPageStore((s) => s.context)
}
