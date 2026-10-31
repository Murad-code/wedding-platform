/**
 * Content-Security-Policy for every surface (ADR-030).
 *
 * Pure so the proxy, `next.config.ts`, and tests share one definition of each policy.
 */

const BASELINE_DIRECTIVES = [
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
]

/** For responses with no inline scripts of ours to protect: the API, and Payload admin. */
export const BASELINE_CSP = BASELINE_DIRECTIVES.join('; ')

export type PagePolicyOptions = { nonce: string; isDevelopment: boolean }

/**
 * The policy for every page the guest site and dashboard render.
 *
 * Scripts must carry this request's nonce; `'strict-dynamic'` lets those scripts load the
 * chunks they need without listing them.
 */
export function pageCsp({ nonce, isDevelopment }: PagePolicyOptions): string {
  return [
    "default-src 'self'",
    // React uses eval only in development, to rebuild server error stacks in the browser.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ''}`,
    // No inline styles either. Styles React sets from script go through the CSSOM, which
    // CSP does not police, so drag-and-drop and live regions still work.
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    ...BASELINE_DIRECTIVES,
  ].join('; ')
}

/** 128 random bits, base64. Generated per request, so it cannot be predicted or reused. */
export function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}
