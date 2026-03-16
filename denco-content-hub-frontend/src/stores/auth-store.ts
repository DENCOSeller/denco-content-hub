import { create } from 'zustand'
import { clearTokens, isAuthenticated as checkAuth } from '@/lib/auth'

interface User {
  id: number
  email: string
  name: string
  is_active: boolean
  is_platform_owner: boolean
  created_at: string
}

interface AuthState {
  user: User | null
  setUser: (user: User) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clearAuth: () => {
    clearTokens()
    set({ user: null })
  },
}))

export { checkAuth as isAuthenticated }
