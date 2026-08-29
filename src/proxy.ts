import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Coarse protection for the organiser area. In Next 16 this file replaces
 * `middleware.ts`.
 *
 * This only checks whether an auth cookie is *present*, to avoid rendering a dashboard
 * shell for an obviously anonymous visitor. It is NOT the authorisation check — Next
 * warns that proxy may be deployed to a CDN edge and should not rely on shared modules,
 * and a cookie can be forged. Real verification happens in `requireOrganiser()` and in
 * Payload's collection access functions (ADR-011).
 *
 * Invitation routes are deliberately not handled here. Their `Referrer-Policy` and
 * `X-Robots-Tag` come from `next.config.ts`, and Next already sends
 * `private, no-store, max-age=0, must-revalidate` for dynamic pages in production.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has('payload-token')) {
    return NextResponse.next()
  }

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('next', request.nextUrl.pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
