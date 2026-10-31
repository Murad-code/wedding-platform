import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { BASELINE_CSP, generateNonce, pageCsp } from '@/domain/security/csp'

/**
 * Runs on every page request. In Next 16 this file replaces `middleware.ts`.
 *
 * Two jobs. It issues each page a fresh CSP nonce, which Next reads from the request
 * header and attaches to its own scripts (ADR-030). And it bounces an obviously anonymous
 * visitor away from the dashboard by cookie presence alone. That is not the
 * authorisation check: `requireOrganiser()` and Payload's access functions are (ADR-011).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/dashboard') && !request.cookies.has('payload-token')) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Payload admin ships its own inline scripts, which carry no nonce of ours.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const response = NextResponse.next()
    response.headers.set('Content-Security-Policy', BASELINE_CSP)
    return response
  }

  const policy = pageCsp({
    nonce: generateNonce(),
    isDevelopment: process.env.NODE_ENV === 'development',
  })

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('Content-Security-Policy', policy)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', policy)
  return response
}

export const config = {
  matcher: [
    {
      // Everything except API routes and build assets, which are not pages.
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      // A prefetched page is cached and reused, so a nonce baked into it would be stale.
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
