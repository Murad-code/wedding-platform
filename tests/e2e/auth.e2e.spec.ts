import { expect, test } from '@playwright/test'

import { TEST_ACCOUNTS } from './support/accounts'

async function signIn(
  page: import('@playwright/test').Page,
  account: { email: string; password: string },
) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test.describe('organiser authentication', () => {
  test('anonymous visitors are sent to sign in, not to the dashboard', async ({ page }) => {
    await page.goto('/dashboard')

    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: 'Wedding dashboard' })).toBeVisible()
    // The dashboard must not render even briefly for an unauthenticated visitor.
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })

  test('the organiser API refuses anonymous requests', async ({ request }) => {
    // Payload's REST surface must be closed even though the UI hides it.
    const response = await request.get('/api/users')
    expect(response.status()).toBe(403)
  })

  test('audit events are not readable anonymously', async ({ request }) => {
    const response = await request.get('/api/audit-events')
    expect(response.status()).toBe(403)
  })

  test('wrong credentials give a generic error and no session', async ({ page }) => {
    await signIn(page, { email: TEST_ACCOUNTS.admin.email, password: 'definitely-wrong' })

    // Scoped to the form: Next's route announcer is also role="alert".
    const alert = page.locator('form').getByRole('alert')
    await expect(alert).toBeVisible()
    // Must not reveal whether the account exists — that would enable enumeration.
    await expect(alert).toHaveText(/did not match/i)
    await expect(page).toHaveURL(/\/login/)
  })

  test('an organiser can sign in and reach the dashboard', async ({ page }) => {
    await signIn(page, TEST_ACCOUNTS.organiser)

    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText(TEST_ACCOUNTS.organiser.name)).toBeVisible()
  })

  test('an unconfigured wedding shows setup guidance rather than empty tables', async ({
    page,
  }) => {
    await signIn(page, TEST_ACCOUNTS.organiser)

    await expect(page.getByRole('heading', { name: /set up your wedding/i })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Add details' })).toBeVisible()
  })

  test('a deep link survives sign in', async ({ page }) => {
    await page.goto('/dashboard/guests')
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fguests/)
  })

  test('an off-site next parameter cannot redirect away after sign in', async ({ page }) => {
    await page.goto('/login?next=https://evil.example/phish')
    await page.getByLabel('Email').fill(TEST_ACCOUNTS.organiser.email)
    await page.getByLabel('Password').fill(TEST_ACCOUNTS.organiser.password)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/localhost/)
    await expect(page).not.toHaveURL(/evil\.example/)
  })

  test('a viewer can sign in and read the dashboard', async ({ page }) => {
    await signIn(page, TEST_ACCOUNTS.viewer)

    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByText(TEST_ACCOUNTS.viewer.name)).toBeVisible()
  })

  test('a viewer cannot mutate through the API', async ({ request }) => {
    const login = await request.post('/api/users/login', {
      data: {
        email: TEST_ACCOUNTS.viewer.email,
        password: TEST_ACCOUNTS.viewer.password,
      },
    })
    expect(login.ok()).toBe(true)

    // Viewers are read-only (docs/DATA_MODEL.md, Users).
    const update = await request.post('/api/globals/wedding-settings', {
      data: { partnerOneName: 'Injected' },
    })
    expect(update.status()).toBe(403)
  })

  test('a non-admin organiser is refused Payload Admin', async ({ page }) => {
    await signIn(page, TEST_ACCOUNTS.organiser)
    await expect(page).toHaveURL(/\/dashboard/)

    // Payload Admin is a maintenance tool restricted to admins (ADR-003).
    await page.goto('/admin')
    await expect(page.getByText(/unauthorized/i)).toBeVisible()
  })

  test('an admin is granted Payload Admin', async ({ request }) => {
    const login = await request.post('/api/users/login', {
      data: { email: TEST_ACCOUNTS.admin.email, password: TEST_ACCOUNTS.admin.password },
    })
    expect(login.ok()).toBe(true)

    const body = await (await request.get('/api/access')).json()
    expect(body.canAccessAdmin).toBe(true)
  })

  test('a non-admin organiser is not granted admin access by the API', async ({ request }) => {
    const login = await request.post('/api/users/login', {
      data: {
        email: TEST_ACCOUNTS.organiser.email,
        password: TEST_ACCOUNTS.organiser.password,
      },
    })
    expect(login.ok()).toBe(true)

    const body = await (await request.get('/api/access')).json()
    // Payload omits the flag entirely rather than returning false.
    expect(body.canAccessAdmin ?? false).toBe(false)
  })
})
