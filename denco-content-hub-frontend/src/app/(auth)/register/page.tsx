'use client'

import { useEffect } from 'react'

import { redirectToSsoLogin } from '@/lib/auth'

/**
 * Legacy register page — redirects to SSO login.
 * Registration is handled by auth.denco.store.
 */
export default function RegisterPage() {
  useEffect(() => {
    redirectToSsoLogin()
  }, [])

  return null
}
