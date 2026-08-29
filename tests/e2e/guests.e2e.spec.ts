import { randomUUID } from 'node:crypto'

import type { Page } from '@playwright/test'

import type { TestAccount } from './support/accounts'
import { expect, test } from './support/fixtures'

async function signIn(page: Page, account: Pick<TestAccount, 'email' | 'password'>) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

/**
 * A token unique to one test, used as both the party name and every guest's surname.
 *
 * The guest list is a shared, persistent collection: scoping *both* means a search for
 * the token can only ever match this test's own rows, however many earlier runs left
 * data behind.
 */
function scope() {
  return `T${randomUUID().slice(0, 8)}`
}

async function uploadCsv(page: Page, csv: string) {
  await page.goto('/dashboard/guests/import')
  await page.getByLabel('CSV file').setInputFiles({
    name: 'guests.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf8'),
  })
  await page.getByRole('button', { name: 'Check file' }).click()
}

async function importCsv(page: Page, csv: string) {
  await uploadCsv(page, csv)
  await page.getByRole('button', { name: 'Import these guests' }).click()
  await expect(page.getByRole('status')).toContainText(/import complete/i)
}

test.describe('guest list', () => {
  test('an organiser can search, filter, and clear', async ({ page, accounts }) => {
    const id = scope()
    await signIn(page, accounts.organiser)

    await importCsv(
      page,
      `party,firstName,lastName,ageGroup,rsvpStatus\n${id},Ada,${id},adult,attending\n${id},Bo,${id},child,declined`,
    )

    await page.goto('/dashboard/guests')

    // Search narrows the list and is reflected in the URL, so the view is shareable.
    await page.getByLabel('Search').fill(id)
    await expect(page).toHaveURL(new RegExp(`q=${id}`))
    await expect(page.getByRole('link', { name: `Ada ${id}` })).toBeVisible()

    // Filtering by RSVP combines with the search.
    await page.getByLabel('RSVP').selectOption('declined')
    await expect(page).toHaveURL(/status=declined/)
    await expect(page.getByRole('link', { name: `Bo ${id}` })).toBeVisible()
    await expect(page.getByRole('link', { name: `Ada ${id}` })).toHaveCount(0)

    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(page).toHaveURL(/\/dashboard\/guests$/)
  })

  test('a filtered URL survives a reload', async ({ page, accounts }) => {
    await signIn(page, accounts.organiser)

    await page.goto('/dashboard/guests?status=attending&sort=recent')
    await page.reload()

    await expect(page.getByLabel('RSVP')).toHaveValue('attending')
    await expect(page.getByLabel('Sort by')).toHaveValue('recent')
  })

  test('an empty result explains itself rather than showing a blank table', async ({
    page,
    accounts,
  }) => {
    await signIn(page, accounts.organiser)
    await page.goto(`/dashboard/guests?q=${scope()}`)

    await expect(page.getByText(/no guests match those filters/i)).toBeVisible()
    await expect(page.getByText(/try clearing a filter/i)).toBeVisible()
  })

  test('an organiser can edit a guest', async ({ page, accounts }) => {
    const id = scope()
    await signIn(page, accounts.organiser)

    await importCsv(page, `party,firstName,lastName\n${id},Editable,${id}`)

    await page.goto(`/dashboard/guests?q=${id}`)
    await page.getByRole('link', { name: `Editable ${id}` }).click()

    await page.getByLabel('Dietary requirements').fill('Coeliac')
    await page.getByLabel('RSVP').selectOption('attending')
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page.getByRole('status')).toContainText(/saved/i)

    // The change is visible on the list, not just in the form.
    await page.goto(`/dashboard/guests?q=${id}`)
    await expect(page.getByText('Coeliac')).toBeVisible()
    await expect(page.locator('[data-rsvp-status="attending"]')).toHaveCount(1)
  })

  test('bulk actions update several guests at once', async ({ page, accounts }) => {
    const id = scope()
    await signIn(page, accounts.organiser)

    await importCsv(page, `party,firstName,lastName\n${id},One,${id}\n${id},Two,${id}`)

    await page.goto(`/dashboard/guests?q=${id}`)
    await page.getByLabel('Select all guests on this page').check()
    await page.getByRole('button', { name: 'Mark attending' }).click()

    await expect(page.locator('[data-rsvp-status="attending"]')).toHaveCount(2)
  })

  test('bulk delete removes the selected guests', async ({ page, accounts }) => {
    const id = scope()
    await signIn(page, accounts.organiser)

    await importCsv(page, `party,firstName,lastName\n${id},Doomed,${id}`)

    await page.goto(`/dashboard/guests?q=${id}`)
    await page.getByLabel('Select all guests on this page').check()
    await page.getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByText(/no guests match those filters/i)).toBeVisible()
  })

  test('the export honours the current filter', async ({ page, accounts }) => {
    await signIn(page, accounts.organiser)
    await page.goto('/dashboard/guests?status=declined')

    const link = page.getByRole('link', { name: 'Export these guests' })
    await expect(link).toHaveAttribute('href', /status=declined/)
  })

  test('the CSV export downloads with a header row', async ({ page, accounts }) => {
    await signIn(page, accounts.organiser)

    const response = await page.request.get('/api/guests/export')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/csv')
    expect(response.headers()['content-disposition']).toContain('attachment')
    expect(await response.text()).toContain('party,firstName')
  })

  test('the export is not reachable anonymously', async ({ browser }) => {
    // Guest data is personal — the download is authorised like any other endpoint.
    const anonymous = await browser.newContext()
    const response = await anonymous.request.get('/api/guests/export', {
      maxRedirects: 0,
      failOnStatusCode: false,
    })
    expect(response.status()).toBeGreaterThanOrEqual(300)
    expect(await response.text()).not.toContain('party,firstName')
    await anonymous.close()
  })
})

test.describe('guest CSV import', () => {
  test('shows a preview before writing anything', async ({ page, accounts }) => {
    const id = scope()
    await signIn(page, accounts.organiser)

    await uploadCsv(page, `party,firstName,lastName\n${id},Preview,${id}`)

    await expect(page.getByText(/ready to import/i)).toBeVisible()
    await expect(page.getByText(`Preview ${id}`)).toBeVisible()

    // Nothing is saved until the organiser confirms.
    await page.goto(`/dashboard/guests?q=${id}`)
    await expect(page.getByText(/no guests match those filters/i)).toBeVisible()
  })

  test('reports per-row errors and still imports the good rows', async ({ page, accounts }) => {
    const id = scope()
    await signIn(page, accounts.organiser)

    await uploadCsv(
      page,
      `party,firstName,lastName,ageGroup\n${id},Good,${id},adult\n,Orphan,${id},adult\n${id},Bad,${id},teenager`,
    )

    await expect(page.getByText(/rows that will be skipped/i)).toBeVisible()
    await expect(page.getByText(/missing party/i)).toBeVisible()
    await expect(page.getByText(/unknown age group/i)).toBeVisible()

    await page.getByRole('button', { name: 'Import these guests' }).click()
    await expect(page.getByRole('status')).toContainText(/import complete/i)
    await expect(page.getByText('1 guest added')).toBeVisible()

    await page.goto(`/dashboard/guests?q=${id}`)
    await expect(page.getByRole('link', { name: `Good ${id}` })).toHaveCount(1)
  })

  test('flags duplicates within the file', async ({ page, accounts }) => {
    const id = scope()
    await signIn(page, accounts.organiser)

    await uploadCsv(page, `party,firstName,lastName\n${id},Dup,${id}\n${id},Dup,${id}`)

    await expect(page.getByText(/duplicates in the file/i)).toBeVisible()
  })

  test('re-importing the same file does not duplicate guests', async ({ page, accounts }) => {
    const id = scope()
    const csv = `party,firstName,lastName\n${id},Reimport,${id}`
    await signIn(page, accounts.organiser)

    await importCsv(page, csv)

    // Correcting and re-uploading a file is what organisers actually do.
    await uploadCsv(page, csv)
    await page.getByRole('button', { name: 'Import these guests' }).click()
    await expect(page.getByText(/1 already on the list, so skipped/i)).toBeVisible()

    await page.goto(`/dashboard/guests?q=${id}`)
    await expect(page.getByRole('link', { name: `Reimport ${id}` })).toHaveCount(1)
  })

  test('rejects a file with no party column', async ({ page, accounts }) => {
    await signIn(page, accounts.organiser)
    await uploadCsv(page, 'firstName,lastName\nNo,Party')

    // Scoped to the form: Next's route announcer is also role="alert".
    await expect(page.locator('form').getByRole('alert')).toContainText(/party/i)
  })

  test('a viewer cannot import', async ({ page, accounts }) => {
    await signIn(page, accounts.viewer)
    await page.goto('/dashboard/guests/import')

    await uploadCsv(page, `party,firstName\n${scope()},Nope`)

    // requireMutator redirects a read-only user away rather than performing the write.
    await expect(page).toHaveURL(/denied=1/)
  })
})
