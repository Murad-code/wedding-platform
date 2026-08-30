import { expect, test } from '@playwright/test'

test.describe('platform smoke', () => {
  test('guest site renders', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('health endpoint reports readiness, not just connectivity', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.status()).toBe(200)

    // The schema check exists because a deployment whose migrations have not run
    // connects fine and serves 500s on every page — which a bare `SELECT 1` probe would
    // report as healthy (docs/IMPLEMENTATION_PLAN.md, Phase 9).
    await expect(response.json()).resolves.toMatchObject({
      status: 'healthy',
      checks: { app: 'ok', database: 'ok', schema: 'ok' },
    })
  })

  test('payload admin is reachable', async ({ page }) => {
    await page.goto('/admin')
    // Unauthenticated visitors land on login or first-user creation, never on data.
    await expect(page.locator('form')).toBeVisible()
  })
})
