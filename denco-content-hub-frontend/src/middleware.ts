import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SSO_BASE_URL = process.env.NEXT_PUBLIC_SSO_BASE_URL || 'https://auth.denco.store'

// Legacy auth routes — redirect to SSO
const legacyAuthRoutes = ['/login', '/register']

// Маршруты открытые для всех — не редиректим никого
const openRoutes = ['/invite', '/public']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Статика и API — пропускаем
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico')
  ) {
    return NextResponse.next()
  }

  const token = request.cookies.get('access_token')?.value
  const isLegacyAuth = legacyAuthRoutes.some((route) => pathname.startsWith(route))
  const isOpenRoute = openRoutes.some((route) => pathname.startsWith(route))

  // Legacy login/register pages → redirect to SSO
  if (isLegacyAuth) {
    const currentUrl = request.nextUrl.searchParams.get('redirect') || request.nextUrl.origin + '/dashboard'
    const ssoLoginUrl = `${SSO_BASE_URL}/login?redirect_to=${encodeURIComponent(currentUrl)}`
    return NextResponse.redirect(ssoLoginUrl)
  }

  // Открытый маршрут — пропускаем всех
  if (isOpenRoute) {
    return NextResponse.next()
  }

  // Не авторизован + защищённый роут → redirect на SSO login
  if (!token && pathname !== '/') {
    const currentUrl = request.nextUrl.href
    const ssoLoginUrl = `${SSO_BASE_URL}/login?redirect_to=${encodeURIComponent(currentUrl)}`
    return NextResponse.redirect(ssoLoginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
