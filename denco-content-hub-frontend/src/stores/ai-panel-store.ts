import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AiPanelState {
  isOpen: boolean
  activeSessionId: string | null
  toggle: () => void
  open: () => void
  close: () => void
  setActiveSessionId: (id: string | null) => void
}

export const useAiPanelStore = create<AiPanelState>()(
  persist(
    (set) => ({
      isOpen: false,
      activeSessionId: null,
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      setActiveSessionId: (id) => set({ activeSessionId: id }),
    }),
    {
      name: 'ai-panel',
      skipHydration: true,
    },
  ),
)
