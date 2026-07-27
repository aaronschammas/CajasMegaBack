// ─── Middleware de autenticación ──────────────────────────────────────────────
// El backend Go setea dos cookies: 'session_token' (principal) y 'jwt' (alias).
// Si ninguna existe → redirige a /login.

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED_PREFIXES = [
  '/movimientos',
  '/ingresos',
  '/egresos',
  '/reporte',
  '/historial',
  '/registro',
  '/alquileres',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  )
  if (!isProtected) return NextResponse.next()

  // El backend setea 'session_token' como cookie primaria y 'jwt' como alias
  const token =
    request.cookies.get('session_token')?.value ||
    request.cookies.get('jwt')?.value

  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/movimientos/:path*',
    '/ingresos/:path*',
    '/egresos/:path*',
    '/reporte/:path*',
    '/historial/:path*',
    '/registro/:path*',
    '/alquileres/:path*',
  ],
}
