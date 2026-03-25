'use client'

import { useEffect } from 'react'
import { redirectToSsoLogin } from '@/lib/auth'

/**
 * Legacy RegisterForm — redirects to SSO.
 * Kept for backward compatibility. All auth is handled by auth.denco.store.
 */
export function RegisterForm() {
  useEffect(() => {
    redirectToSsoLogin()
  }, [])

  return null
}
