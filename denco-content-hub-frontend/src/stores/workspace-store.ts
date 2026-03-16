import { create } from 'zustand'
import { getCookie, setCookie, deleteCookie } from '@/lib/cookies'

interface ActiveWorkspace {
  id: number
  name: string
  slug: string
  company_name: string
}

function readWorkspaceFromCookie(): ActiveWorkspace | null {
  const raw = getCookie('active_workspace')
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.id === 'number') return parsed as ActiveWorkspace
  } catch {
    // corrupted cookie
  }
  return null
}

interface WorkspaceState {
  activeWorkspace: ActiveWorkspace | null
  setActiveWorkspace: (workspace: ActiveWorkspace) => void
  clearActiveWorkspace: () => void
  hydrateFromCookie: () => void
}

export const useWorkspaceStore = create<WorkspaceState>()((set) => ({
  activeWorkspace: null,
  setActiveWorkspace: (workspace) => {
    setCookie('active_workspace', JSON.stringify(workspace), 30)
    set({ activeWorkspace: workspace })
  },
  clearActiveWorkspace: () => {
    deleteCookie('active_workspace')
    set({ activeWorkspace: null })
  },
  hydrateFromCookie: () => {
    set({ activeWorkspace: readWorkspaceFromCookie() })
  },
}))
