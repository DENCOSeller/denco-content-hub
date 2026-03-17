import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Маршруты только для неавторизованных — авторизованных редиректим на /dashboard
const authRoutes = ['/login', '/register']

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
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route))
  const isOpenRoute = openRoutes.some((route) => pathname.startsWith(route))

  // Авторизован + страница входа/регистрации → на redirect или /dashboard
  if (token && isAuthRoute) {
    const redirectTo = request.nextUrl.searchParams.get('redirect') || '/dashboard'
    return NextResponse.redirect(new URL(redirectTo, request.url))
  }

  // Открытый маршрут — пропускаем всех
  if (isOpenRoute) {
    return NextResponse.next()
  }

  // Не авторизован + защищённый роут → на логин
  if (!token && !isAuthRoute && pathname !== '/') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
