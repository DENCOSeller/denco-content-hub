/**
 * JWT payload parser — extracts org info from access token.
 * Does NOT verify signature (that's the backend's job).
 */

export interface JwtOrgInfo {
  id: number
  name: string
  slug: string
  role?: string
}

export interface JwtPayload {
  sub: number
  email: string
  full_name: string
  v?: number
  active_org?: JwtOrgInfo
  available_orgs?: JwtOrgInfo[]
  /** v2 compat */
  organizations?: Array<{ id: number; name: string; slug: string; role?: string }>
  exp?: number
  iat?: number
  [key: string]: unknown
}

/**
 * Decode JWT payload without verification.
 * Returns null if token is invalid/missing.
 */
export function decodeJwtPayload(token: string | null): JwtPayload | null {
  if (!token) return null

  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const payload = parts[1]
    // Base64url decode
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    )
    return JSON.parse(json) as JwtPayload
  } catch {
    return null
  }
}

/**
 * Extract available organizations from JWT.
 * Supports both v3 (available_orgs) and v2 (organizations) formats.
 */
export function getOrgsFromJwt(token: string | null): {
  activeOrg: JwtOrgInfo | null
  availableOrgs: JwtOrgInfo[]
} {
  const payload = decodeJwtPayload(token)
  if (!payload) return { activeOrg: null, availableOrgs: [] }

  // v3 format
  if (payload.v === 3 || payload.available_orgs) {
    return {
      activeOrg: payload.active_org ?? null,
      availableOrgs: payload.available_orgs ?? [],
    }
  }

  // v2 fallback
  if (payload.organizations && payload.organizations.length > 0) {
    const orgs: JwtOrgInfo[] = payload.organizations.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      role: o.role,
    }))
    return {
      activeOrg: orgs[0] ?? null,
      availableOrgs: orgs,
    }
  }

  return { activeOrg: null, availableOrgs: [] }
}
