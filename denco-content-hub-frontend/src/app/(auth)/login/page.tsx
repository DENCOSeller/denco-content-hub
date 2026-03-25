'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

import { redirectToSsoLogin, SSO_BASE_URL } from '@/lib/auth'

/**
 * Legacy login page — immediately redirects to SSO.
 * Kept as a client-side fallback in case middleware redirect is bypassed.
 */
export default function LoginPage() {
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect')

  useEffect(() => {
    if (redirect) {
      window.location.href = `${SSO_BASE_URL}/login?redirect_to=${encodeURIComponent(redirect)}`
    } else {
      redirectToSsoLogin()
    }
  }, [redirect])

  return null
}
