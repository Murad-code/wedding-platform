import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Coarse route protection. In Next 16 this file replaces `middleware.ts`.
 *
 * This only checks whether an auth cookie is *present*, to avoid rendering a dashboard
 * shell for an obviously anonymous visitor. It is NOT the authorisation check — Next
 * explicitly warns that proxy should not depend on shared modules, and a cookie can be
 * forged. Real verification happens in `requireOrganiser()` and in Payload's collection
 * access functions (docs/SECURITY.md §5).
 */
export function proxy(request: NextRequest) {
  const hasAuthCookie = request.cookies.has('payload-token')

  if (!hasAuthCookie) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
