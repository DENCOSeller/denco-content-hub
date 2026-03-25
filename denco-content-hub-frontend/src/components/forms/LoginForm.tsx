'use client'

import { useEffect } from 'react'
import { redirectToSsoLogin } from '@/lib/auth'

/**
 * Legacy LoginForm — redirects to SSO.
 * Kept for backward compatibility. All auth is handled by auth.denco.store.
 */
export function LoginForm() {
  useEffect(() => {
    redirectToSsoLogin()
  }, [])

  return null
}
