import { create } from 'zustand'
import { getCookie, setCookie, deleteCookie } from '@/lib/cookies'

interface ActiveCompany {
  id: number
  name: string
  slug: string
}

function readCompanyFromCookie(): ActiveCompany | null {
  const raw = getCookie('active_company')
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.id === 'number') return parsed as ActiveCompany
  } catch {
    // corrupted cookie
  }
  return null
}

interface CompanyState {
  activeCompany: ActiveCompany | null
  setActiveCompany: (company: ActiveCompany) => void
  clearActiveCompany: () => void
  hydrateFromCookie: () => void
}

export const useCompanyStore = create<CompanyState>()((set) => ({
  activeCompany: null,
  setActiveCompany: (company) => {
    setCookie('active_company', JSON.stringify(company), 30)
    set({ activeCompany: company })
  },
  clearActiveCompany: () => {
    deleteCookie('active_company')
    set({ activeCompany: null })
  },
  hydrateFromCookie: () => {
    set({ activeCompany: readCompanyFromCookie() })
  },
}))
