import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const MIN_PANEL_WIDTH = 320
const MAX_PANEL_WIDTH = 600
const DEFAULT_PANEL_WIDTH = 380

interface AiPanelState {
  isOpen: boolean
  activeSessionId: string | null
  panelWidth: number
  toggle: () => void
  open: () => void
  close: () => void
  setActiveSessionId: (id: string | null) => void
  setPanelWidth: (width: number) => void
}

export { MIN_PANEL_WIDTH, MAX_PANEL_WIDTH, DEFAULT_PANEL_WIDTH }

export const useAiPanelStore = create<AiPanelState>()(
  persist(
    (set) => ({
      isOpen: false,
      activeSessionId: null,
      panelWidth: DEFAULT_PANEL_WIDTH,
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      setActiveSessionId: (id) => set({ activeSessionId: id }),
      setPanelWidth: (width) =>
        set({ panelWidth: Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, width)) }),
    }),
    {
      name: 'ai-panel',
      skipHydration: true,
    },
  ),
)
