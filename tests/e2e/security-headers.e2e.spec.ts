import type { Page } from '@playwright/test'

import { expect, test } from './support/fixtures'

/**
 * Security headers, asserted rather than assumed.
 *
 * These are set in `next.config.ts` and `src/proxy.ts` and are easy to lose in a refactor
 * without anything failing, which is precisely why they need a test. The invitation page has its own
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

const nonceOf = (csp: string) => /'nonce-([^']+)'/.exec(csp)?.[1] ?? null

/** Records every CSP violation the page reports, from the first byte of the document. */
async function watchForViolations(page: Page) {
  const refusals: string[] = []
  page.on('console', (message) => {
    if (/content security policy|refused to/i.test(message.text())) refusals.push(message.text())
  })
  await page.addInitScript(() => {
    const seen: string[] = []
    ;(window as unknown as { __cspViolations: string[] }).__cspViolations = seen
    document.addEventListener('securitypolicyviolation', (event) => {
      seen.push(`${event.violatedDirective} blocked ${event.blockedURI || 'inline'}`)
    })
  })
  return async () => [
    ...refusals,
    ...(await page.evaluate(
      () => (window as unknown as { __cspViolations?: string[] }).__cspViolations ?? [],
    )),
  ]
}

test.describe('content security policy', () => {
  test('pages only run scripts carrying a nonce that changes every request', async ({ page }) => {
    const first = (await page.goto('/'))!.headers()['content-security-policy'] ?? ''
    const second = (await page.goto('/'))!.headers()['content-security-policy'] ?? ''

    expect(first).toContain("'strict-dynamic'")
    expect(first).not.toMatch(/script-src[^;]*'unsafe-inline'/)
    expect(nonceOf(first)).not.toBeNull()
    expect(nonceOf(first)).not.toBe(nonceOf(second))
  })

  test('Next attaches the nonce to every script it renders', async ({ page }) => {
    const csp = (await page.goto('/'))!.headers()['content-security-policy'] ?? ''
    // Browsers hide the nonce attribute after load; the property still holds it.
    const nonces = await page
      .locator('script')
      .evaluateAll((scripts) => scripts.map((script) => (script as HTMLScriptElement).nonce))

    expect(nonces.length).toBeGreaterThan(0)
    expect(new Set(nonces)).toEqual(new Set([nonceOf(csp)]))
  })

  test('the guest site runs without a single violation', async ({ page }) => {
    const violations = await watchForViolations(page)

    for (const path of ['/', '/our-day', '/venue', '/faqs', '/contact', '/menu', '/rsvp']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    }
    // The live photo screen also opens an EventSource, which connect-src has to allow.
    await page.goto('/photos')
    await expect(page.locator('[data-connection="live"]')).toBeVisible()

    expect(await violations()).toEqual([])
  })

  test('the dashboard runs without a single violation', async ({ page, accounts }) => {
    const violations = await watchForViolations(page)

    await page.goto('/login')
    await page.getByLabel('Email').fill(accounts.admin.email)
    await page.getByLabel('Password').fill(accounts.admin.password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/dashboard/)

    for (const path of ['/dashboard/guests', '/dashboard/photos/run', '/dashboard/team']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    }

    // dnd-kit hides its screen-reader instructions with an inline style set from script.
    // If the policy blocked that, the instructions would appear on the page.
    await page.goto('/dashboard/seating')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const instructions = page.getByText(/to pick up a draggable item/i)
    await expect(instructions).toBeAttached()
    await expect(instructions).toBeHidden()

    expect(await violations()).toEqual([])
  })

  test('Payload admin and the API keep the baseline policy', async ({ page, request }) => {
    const admin = (await page.goto('/admin'))!.headers()['content-security-policy'] ?? ''
    expect(admin).toContain("frame-ancestors 'none'")
    expect(admin).not.toContain('script-src')

    const api = (await request.get('/api/health')).headers()['content-security-policy'] ?? ''
    expect(api).toContain("base-uri 'self'")
  })
})
