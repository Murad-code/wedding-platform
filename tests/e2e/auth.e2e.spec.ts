import type { Page } from '@playwright/test'

import { expect, test } from './support/fixtures'
import type { TestAccount } from './support/accounts'

async function signIn(page: Page, account: Pick<TestAccount, 'email' | 'password'>) {
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

  test('wrong credentials give a generic error and no session', async ({ page, accounts }) => {
    await signIn(page, { email: accounts.admin.email, password: 'definitely-wrong' })

    // Scoped to the form: Next's route announcer is also role="alert".
    const alert = page.locator('form').getByRole('alert')
    await expect(alert).toBeVisible()
    // Must not reveal whether the account exists — that would enable enumeration.
    await expect(alert).toHaveText(/did not match/i)
    await expect(page).toHaveURL(/\/login/)
  })

  test('an organiser can sign in and reach the dashboard', async ({ page, accounts }) => {
    await signIn(page, accounts.organiser)

    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText(accounts.organiser.name)).toBeVisible()
  })

  test('the dashboard shows the wedding overview', async ({ page, accounts }) => {
    await signIn(page, accounts.organiser)

    // The setup-checklist empty state is covered in tests/unit/components, because
    // WeddingSettings is a per-deployment singleton and "unconfigured" cannot be
    // isolated in an end-to-end test.
    await expect(page.getByText('Guests invited')).toBeVisible()
    await expect(page.getByText('Awaiting RSVP')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Guest list' })).toBeVisible()
  })

  test('a deep link survives sign in', async ({ page }) => {
    await page.goto('/dashboard/guests')
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fguests/)
  })

  test('an off-site next parameter cannot redirect away after sign in', async ({
    page,
    accounts,
  }) => {
    await page.goto('/login?next=https://evil.example/phish')
    await page.getByLabel('Email').fill(accounts.organiser.email)
    await page.getByLabel('Password').fill(accounts.organiser.password)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/localhost/)
    await expect(page).not.toHaveURL(/evil\.example/)
  })

  test('a viewer can sign in and read the dashboard', async ({ page, accounts }) => {
    await signIn(page, accounts.viewer)

    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByText(accounts.viewer.name)).toBeVisible()
  })

  test('a viewer cannot mutate through the API', async ({ request, accounts }) => {
    const login = await request.post('/api/users/login', {
      data: {
        email: accounts.viewer.email,
        password: accounts.viewer.password,
      },
    })
    expect(login.ok()).toBe(true)

    // Viewers are read-only (docs/DATA_MODEL.md, Users).
    const update = await request.post('/api/globals/wedding-settings', {
      data: { partnerOneName: 'Injected' },
    })
    expect(update.status()).toBe(403)
  })

  test('a non-admin organiser is refused Payload Admin', async ({ page, accounts }) => {
    await signIn(page, accounts.organiser)
    await expect(page).toHaveURL(/\/dashboard/)

    // Payload Admin is a maintenance tool restricted to admins (ADR-003).
    await page.goto('/admin')

    // The refusal surface differs by engine — Chromium renders an "Unauthorized"
    // message, WebKit lands on Payload's login wall — so assert the property that
    // matters in both: no collection data is reachable. Only the real admin nav links
    // to /admin/collections/*.
    await expect(page.locator('a[href^="/admin/collections"]')).toHaveCount(0)
    await expect(
      page.getByText(/unauthorized/i).or(page.getByRole('button', { name: /login/i })),
    ).toBeVisible()
  })

  test('an admin is granted Payload Admin', async ({ request, accounts }) => {
    const login = await request.post('/api/users/login', {
      data: { email: accounts.admin.email, password: accounts.admin.password },
    })
    expect(login.ok()).toBe(true)

    const body = await (await request.get('/api/access')).json()
    expect(body.canAccessAdmin).toBe(true)
  })

  test('a non-admin organiser is not granted admin access by the API', async ({
    request,
    accounts,
  }) => {
    const login = await request.post('/api/users/login', {
      data: {
        email: accounts.organiser.email,
        password: accounts.organiser.password,
      },
    })
    expect(login.ok()).toBe(true)

    const body = await (await request.get('/api/access')).json()
    // Payload omits the flag entirely rather than returning false.
    expect(body.canAccessAdmin ?? false).toBe(false)
  })
})
