/**
 * Restricts a post-login destination to a same-site path.
 *
 * The login page accepts `?next=` so a deep link survives authentication. Without this,
 * `?next=https://evil.example` would turn login into an open redirect and make a
 * convincing credential-phishing lure.
 */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/

export function sanitiseRedirect(next: unknown, fallback = '/dashboard'): string {
  if (typeof next !== 'string' || next.length === 0) return fallback

  // Must be an absolute path on this site.
  if (!next.startsWith('/')) return fallback
  // `//host` and `/\host` are protocol-relative URLs pointing elsewhere.
  if (next.startsWith('//') || next.startsWith('/\\')) return fallback
  // Control characters can be used to split the URL or smuggle a header.
  if (CONTROL_CHARACTERS.test(next)) return fallback

  return next
}
