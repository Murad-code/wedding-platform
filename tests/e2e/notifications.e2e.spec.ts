import { randomUUID } from 'node:crypto'

import type { Page } from '@playwright/test'

import type { TestAccount } from './support/accounts'
import { expect, test as base } from './support/fixtures'

/**
 * Cleanup belongs in a fixture, not at the end of a test body: a test that fails before
 * its last line leaves its party behind, which is exactly how four stray parties
 * accumulated while this file was being written.
 */
const test = base.extend<{ id: string }>({
  id: async ({ page }, use) => {
    const id = `T${randomUUID().slice(0, 8)}`
    await use(id)
    await page.request
      .delete(`/api/invitation-parties?where[displayName][contains]=${id}`)
      .catch(() => undefined)
  },
})

async function signIn(page: Page, account: Pick<TestAccount, 'email' | 'password'>) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

/**
 * Read-only checks that do not touch the photo queue, so they are safe alongside
 * `photo-queue.e2e.spec.ts`, which owns it.
 */
test.describe('the messages page', () => {
  test('an organiser can see what has been sent', async ({ page, accounts }) => {
    await signIn(page, accounts.organiser)
    await page.goto('/dashboard/notifications')

    await expect(page.getByRole('heading', { name: 'Messages', level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: /try sending now/i })).toBeVisible()
  })

  test('a viewer cannot make the platform send anything', async ({ page, accounts }) => {
    // Sending costs money and reaches real people, so it is a mutation.
    await signIn(page, accounts.viewer)
    await page.goto('/dashboard/notifications')

    await page.getByRole('button', { name: /try sending now/i }).click()
    await expect(page).toHaveURL(/denied=1/)
  })

  test('is not reachable without signing in', async ({ browser }) => {
    const anonymous = await browser.newContext()
    const page = await anonymous.newPage()

    await page.goto('/dashboard/notifications')
    await expect(page).toHaveURL(/\/login/)

    await anonymous.close()
  })

  test('the delivery record is closed to anonymous requests', async ({ browser }) => {
    // Rows carry the rendered message, which contains a guest's name.
    const anonymous = await browser.newContext()
    const response = await anonymous.request.get('/api/notifications', { failOnStatusCode: false })

    expect(response.status()).toBeGreaterThanOrEqual(400)
    await anonymous.close()
  })

  test('the dispatch endpoint cannot be triggered anonymously', async ({ browser }) => {
    const anonymous = await browser.newContext()
    const response = await anonymous.request.post('/api/notifications/dispatch', {
      maxRedirects: 0,
      failOnStatusCode: false,
    })

    expect(response.status()).toBeGreaterThanOrEqual(300)
    await anonymous.close()
  })
})

test.describe('SMS consent', () => {
  test('the RSVP form asks for no phone number when the wedding does not send texts', async ({
    page,
  }) => {
    // Data minimisation is not a setting to remember — collecting a number the platform
    // will never use is the thing to avoid (docs/SECURITY.md §7). SMS is off by default.
    await page.goto('/rsvp')
    await expect(page.getByLabel(/mobile number/i)).toHaveCount(0)
    await expect(page.getByLabel(/text this number/i)).toHaveCount(0)
  })

  test('an organiser records consent explicitly, never inferring it from a number', async ({
    page,
    accounts,
    id,
  }) => {
    await signIn(page, accounts.organiser)

    // Its own guest, so the test does not depend on whatever else is in the database.
    await page.goto('/dashboard/guests/import')
    await page.getByLabel('CSV file').setInputFiles({
      name: 'guests.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        `party,firstName,lastName,phone\n${id},Consent,${id},+447700900123`,
        'utf8',
      ),
    })
    await page.getByRole('button', { name: 'Check file' }).click()
    await page.getByRole('button', { name: 'Import these guests' }).click()
    await expect(page.getByRole('status')).toContainText(/import complete/i)

    await page.goto(`/dashboard/guests?q=${id}`)
    await page.getByRole('link', { name: `Consent ${id}` }).click()

    // A number is on file, and the tick is still separate and still unticked.
    await expect(page.getByLabel('Phone', { exact: true })).toHaveValue('+447700900123')
    await expect(page.getByLabel(/agreed to receive text messages/i)).not.toBeChecked()
    await expect(page.getByText(/a phone number on its own is not permission/i)).toBeVisible()
  })
})
