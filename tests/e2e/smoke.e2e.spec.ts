import { expect, test } from '@playwright/test'

test.describe('platform smoke', () => {
  test('guest site renders', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('health endpoint reports database connectivity', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.status()).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      status: 'healthy',
      checks: { app: 'ok', database: 'ok' },
    })
  })

  test('payload admin is reachable', async ({ page }) => {
    await page.goto('/admin')
    // Unauthenticated visitors land on login or first-user creation, never on data.
    await expect(page.locator('form')).toBeVisible()
  })
})
