import { expect, test } from './support/fixtures'

/**
 * Security headers, asserted rather than assumed.
 *
 * These are set in `next.config.ts` and are easy to lose in a refactor without anything
 * failing — which is precisely why they need a test. The invitation page has its own
 * coverage in `rsvp.e2e.spec.ts`; this covers the rest of the surface.
 */

const TOKEN_SHAPED = 'a'.repeat(43)

test.describe('security headers', () => {
  test('every page carries the baseline headers', async ({ page }) => {
    const response = await page.goto('/')
    const headers = response!.headers()

    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
  })

  test('the content security policy blocks the injections it can', async ({ page }) => {
    const response = await page.goto('/')
    const csp = response!.headers()['content-security-policy'] ?? ''

    // A `<base>` tag rewrites every relative URL on the page; a form action rewrite
    // sends a submitted RSVP somewhere else entirely.
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("form-action 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
  })

  test('the token-scoped photo screen is treated like the invitation page', async ({ page }) => {
    // Same class of URL, same protection: the token in the path is the credential.
    const response = await page.goto(`/photos/${TOKEN_SHAPED}`)
    const headers = response!.headers()

    expect(headers['x-robots-tag']).toContain('noindex')
    expect(headers['referrer-policy']).toBe('no-referrer')
    expect(headers['cache-control'] ?? '').toMatch(/no-cache|no-store/)
  })

  test('the public photo screen is not given token protections it does not need', async ({
    page,
  }) => {
    // `/photos` carries no credential, so it keeps the site-wide policy. Asserted so the
    // single-segment matcher cannot silently widen.
    const response = await page.goto('/photos')

    expect(response!.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin')
  })

  test('Payload admin is not offered to search engines', async ({ page }) => {
    const response = await page.goto('/admin')

    expect(response!.headers()['x-robots-tag']).toContain('noindex')
  })
})
