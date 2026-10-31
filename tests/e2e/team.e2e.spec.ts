import { randomUUID } from 'node:crypto'

import type { Browser, Page } from '@playwright/test'

import { expect, test as base } from './support/fixtures'

/** Removes every account a test created, even when the test fails partway. */
const test = base.extend<{ id: string }>({
  id: async ({ page }, use) => {
    // Lower case: the add form lower-cases emails, and sign-in must match.
    const id = `t${randomUUID().slice(0, 8)}`
    await use(id)
    await page.request.delete(`/api/users?where[email][contains]=${id}`).catch(() => undefined)
  },
})

/** For a sign-in that should fail: returns as soon as the form is submitted. */
async function attemptSignIn(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

/** Waits for the dashboard, so a following navigation cannot race the session cookie. */
async function signIn(page: Page, email: string, password: string) {
  await attemptSignIn(page, email, password)
  await expect(page).toHaveURL(/\/dashboard/)
}

async function addMember(
  page: Page,
  member: { name: string; email: string; role: string; password: string },
) {
  await page.goto('/dashboard/team')
  const form = page
    .locator('form')
    .filter({ has: page.getByRole('heading', { name: 'Add someone' }) })
  await form.getByLabel('Name').fill(member.name)
  await form.getByLabel('Email').fill(member.email)
  await form.getByLabel('Role').selectOption(member.role)
  await form.getByLabel('Starting password').fill(member.password)
  await form.getByRole('button', { name: 'Add to the team' }).click()
  await expect(form.getByRole('status')).toContainText(`Added ${member.name}`)
}

/** A second browser, so signing in as the new person does not sign the admin out. */
async function asSomeoneElse(browser: Browser) {
  const context = await browser.newContext()
  return { context, page: await context.newPage() }
}

test.describe('team management', () => {
  test('an admin adds someone, who signs in with the role they were given', async ({
    page,
    browser,
    accounts,
    id,
  }) => {
    await signIn(page, accounts.admin.email, accounts.admin.password)
    const email = `${id}-viewer@example.test`
    await addMember(page, {
      name: `Viewer ${id}`,
      email,
      role: 'viewer',
      password: `${id}-password-1`,
    })

    const other = await asSomeoneElse(browser)
    await signIn(other.page, email, `${id}-password-1`)
    await expect(other.page).toHaveURL(/\/dashboard/)
    // Only admins are offered team management.
    await expect(other.page.getByRole('link', { name: 'Team' })).toHaveCount(0)
    await other.context.close()
  })

  test('one email cannot have two accounts', async ({ page, accounts, id }) => {
    await signIn(page, accounts.admin.email, accounts.admin.password)
    const member = {
      name: `Dup ${id}`,
      email: `${id}-dup@example.test`,
      role: 'organiser',
      password: `${id}-password-1`,
    }
    await addMember(page, member)

    const form = page
      .locator('form')
      .filter({ has: page.getByRole('heading', { name: 'Add someone' }) })
    await form.getByLabel('Name').fill(member.name)
    await form.getByLabel('Email').fill(member.email)
    await form.getByLabel('Starting password').fill(member.password)
    await form.getByRole('button', { name: 'Add to the team' }).click()
    await expect(form.getByRole('alert')).toContainText(/already an account/i)
  })

  test('an admin changes someone’s role', async ({ page, accounts, id }) => {
    await signIn(page, accounts.admin.email, accounts.admin.password)
    const name = `Role ${id}`
    await addMember(page, {
      name,
      email: `${id}-role@example.test`,
      role: 'organiser',
      password: `${id}-password-1`,
    })

    await page.getByLabel(`Role for ${name}`).selectOption('viewer')
    await page.getByRole('button', { name: `Save role for ${name}` }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Role updated' })).toBeVisible()

    await page.reload()
    await expect(page.getByLabel(`Role for ${name}`)).toHaveValue('viewer')
  })

  test('a removed person can no longer sign in', async ({ page, accounts, id }) => {
    await signIn(page, accounts.admin.email, accounts.admin.password)
    const name = `Gone ${id}`
    const email = `${id}-gone@example.test`
    await addMember(page, { name, email, role: 'organiser', password: `${id}-password-1` })

    await page.getByRole('button', { name: `Remove ${name}` }).click()
    await expect(page.getByText(email)).toHaveCount(0)

    const anonymous = await page.context().browser()!.newContext()
    const other = await anonymous.newPage()
    await attemptSignIn(other, email, `${id}-password-1`)
    await expect(other.locator('form').getByRole('alert')).toHaveText(/did not match/i)
    await anonymous.close()
  })

  test('an admin is not offered controls over their own account', async ({ page, accounts }) => {
    // The server refuses it too (unit and integration tests); this is the dashboard not
    // offering a button that could only fail.
    await signIn(page, accounts.admin.email, accounts.admin.password)
    await page.goto('/dashboard/team')

    await expect(page.getByRole('button', { name: `Remove ${accounts.admin.name}` })).toHaveCount(0)
    await expect(page.getByLabel(`Role for ${accounts.admin.name}`)).toHaveCount(0)
  })

  test('setting someone’s password signs them out everywhere', async ({
    page,
    browser,
    accounts,
    id,
  }) => {
    await signIn(page, accounts.admin.email, accounts.admin.password)
    const name = `Reset ${id}`
    const email = `${id}-reset@example.test`
    await addMember(page, { name, email, role: 'organiser', password: `${id}-password-1` })

    const other = await asSomeoneElse(browser)
    await signIn(other.page, email, `${id}-password-1`)
    await expect(other.page).toHaveURL(/\/dashboard/)

    await page.getByText(`Set a new password for ${name}`).click()
    await page.getByLabel(`New password for ${name}`).fill(`${id}-password-2`)
    await page.getByRole('button', { name: 'Set password' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Password set' })).toBeVisible()

    // Their existing session no longer works...
    await other.page.goto('/dashboard')
    await expect(other.page).toHaveURL(/\/login/)
    // ...and the new password does.
    await signIn(other.page, email, `${id}-password-2`)
    await expect(other.page).toHaveURL(/\/dashboard/)
    await other.context.close()
  })

  test('organisers and viewers cannot reach team management', async ({ page, accounts }) => {
    for (const account of [accounts.organiser, accounts.viewer]) {
      await page.context().clearCookies()
      await signIn(page, account.email, account.password)
      await expect(page).toHaveURL(/\/dashboard/)

      await page.goto('/dashboard/team')
      await expect(page).toHaveURL(/denied=1/)
    }
  })

  test('the team list is not reachable anonymously', async ({ browser }) => {
    const anonymous = await browser.newContext()
    const response = await anonymous.request.get('/api/users', { failOnStatusCode: false })
    expect(response.status()).toBeGreaterThanOrEqual(400)
    await anonymous.close()
  })
})

test.describe('your account', () => {
  test('anyone can change their own password, and must then sign in again', async ({
    page,
    browser,
    accounts,
    id,
  }) => {
    await signIn(page, accounts.admin.email, accounts.admin.password)
    const email = `${id}-self@example.test`
    await addMember(page, {
      name: `Self ${id}`,
      email,
      role: 'viewer',
      password: `${id}-password-1`,
    })

    const other = await asSomeoneElse(browser)
    await signIn(other.page, email, `${id}-password-1`)
    await other.page.getByRole('link', { name: 'Your account' }).click()

    // A session cookie alone must not be enough to take the account over.
    await other.page.getByLabel('Current password').fill('not-my-password')
    await other.page.getByLabel('New password', { exact: true }).fill(`${id}-password-2`)
    await other.page.getByLabel('New password again').fill(`${id}-password-2`)
    await other.page.getByRole('button', { name: 'Change password' }).click()
    await expect(other.page.locator('form').getByRole('alert')).toContainText(
      /not your current password/i,
    )

    await other.page.getByLabel('Current password').fill(`${id}-password-1`)
    await other.page.getByLabel('New password', { exact: true }).fill(`${id}-password-2`)
    await other.page.getByLabel('New password again').fill(`${id}-password-2`)
    await other.page.getByRole('button', { name: 'Change password' }).click()

    await expect(other.page).toHaveURL(/\/login\?passwordChanged=1/)
    await expect(
      other.page.getByRole('status').filter({ hasText: 'password has been changed' }),
    ).toBeVisible()

    await attemptSignIn(other.page, email, `${id}-password-1`)
    await expect(other.page.locator('form').getByRole('alert')).toHaveText(/did not match/i)
    await signIn(other.page, email, `${id}-password-2`)
    await expect(other.page).toHaveURL(/\/dashboard/)
    await other.context.close()
  })

  test('a new password has to be typed the same twice', async ({ page, accounts }) => {
    await signIn(page, accounts.viewer.email, accounts.viewer.password)
    await page.goto('/dashboard/account')

    await page.getByLabel('Current password').fill(accounts.viewer.password)
    await page.getByLabel('New password', { exact: true }).fill('a-perfectly-long-password')
    await page.getByLabel('New password again').fill('a-different-long-password')
    await page.getByRole('button', { name: 'Change password' }).click()

    await expect(page.locator('form').getByRole('alert')).toContainText(/do not match/i)
  })
})
