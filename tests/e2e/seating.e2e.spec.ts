import { randomUUID } from 'node:crypto'

import type { Page } from '@playwright/test'

import type { TestAccount } from './support/accounts'
import { expect, test as base } from './support/fixtures'

/**
 * Tables are shared content, and one left behind widens every other test's plan. The
 * fixture removes anything carrying the id even when a test fails before its own
 * cleanup.
 */
const test = base.extend<{ id: string }>({
  id: async ({ page }, use) => {
    const id = `T${randomUUID().slice(0, 8)}`
    await use(id)
    await page.request.delete(`/api/tables?where[name][contains]=${id}`).catch(() => undefined)
    await page.request
      .delete(`/api/invitation-parties?where[displayName][contains]=${id}`)
      .catch(() => undefined)
  },
})

/**
 * The plan shows every attending guest in the wedding, so global counts belong to the
 * whole dataset, not to one test. Each assertion is scoped to this test's own table or
 * its own guest instead.
 */
const tableCard = (page: Page, name: string) =>
  page
    .locator('article')
    // Matched on the heading, not the card's whole text: guests created by a test carry
    // that test's id in their surname, so any table they sit at would match too.
    .filter({ has: page.getByRole('heading', { level: 3, name, exact: true }) })

const occupancyOf = (page: Page, name: string) => tableCard(page, name).locator('[data-occupancy]')

/** Where a guest is currently seated, read from their own control. */
const seatOf = (page: Page, guestName: string) =>
  page.getByLabel(`Seat ${guestName} at`).locator('option:checked')

/**
 * Seats a guest and waits for the write to land.
 *
 * The plan updates optimistically, so asserting on the UI alone would race the server
 * action — a reload could arrive before the change was ever saved.
 */
async function seatGuest(page: Page, guestName: string, tableName: string) {
  await page.getByLabel(`Seat ${guestName} at`).selectOption({ label: tableName })
  await expect(page.locator('[data-saving="false"]')).toBeVisible()
}

async function signIn(page: Page, account: Pick<TestAccount, 'email' | 'password'>) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

async function addTable(page: Page, name: string, capacity: number) {
  await page.goto('/dashboard/seating')
  await page.getByLabel('Table name').fill(name)
  await page.getByLabel('Seats').fill(String(capacity))
  await page.getByRole('button', { name: 'Add table' }).click()
  await expect(page.getByRole('heading', { level: 3, name })).toBeVisible()
}

/**
 * Creates attending guests, since only accepted guests can be seated.
 * Returns their display names.
 */
async function createAttendingGuests(page: Page, id: string, count: number) {
  await page.goto('/dashboard/guests/import')
  const rows = Array.from(
    { length: count },
    (_, index) => `${id},Seat${index},${id},adult,attending`,
  ).join('\n')

  await page.getByLabel('CSV file').setInputFiles({
    name: 'guests.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(`party,firstName,lastName,ageGroup,rsvpStatus\n${rows}`, 'utf8'),
  })
  await page.getByRole('button', { name: 'Check file' }).click()
  await page.getByRole('button', { name: 'Import these guests' }).click()
  await expect(page.getByRole('status')).toContainText(/import complete/i)

  return Array.from({ length: count }, (_, index) => `Seat${index} ${id}`)
}

/** One attending guest, typed as definitely present so tests need no non-null assertions. */
async function createAttendingGuest(page: Page, id: string): Promise<string> {
  await createAttendingGuests(page, id, 1)
  return `Seat0 ${id}`
}

test.describe('seating plan', () => {
  test('an organiser can create a table', async ({ page, accounts, id }) => {
    await signIn(page, accounts.organiser)
    await addTable(page, id, 8)

    await expect(occupancyOf(page, id)).toHaveText(/0\/8/)
  })

  test('table names must be unique so the plan reads unambiguously', async ({
    page,
    accounts,
    id,
  }) => {
    await signIn(page, accounts.organiser)
    await addTable(page, id, 8)

    await page.getByLabel('Table name').fill(id)
    await page.getByRole('button', { name: 'Add table' }).click()

    await expect(page.locator('form').getByRole('alert')).toContainText(/already a table/i)
  })

  test('only attending guests appear in the plan', async ({ page, accounts, id }) => {
    await signIn(page, accounts.organiser)

    await page.goto('/dashboard/guests/import')
    await page.getByLabel('CSV file').setInputFiles({
      name: 'guests.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        `party,firstName,lastName,rsvpStatus\n${id},Coming,${id},attending\n${id},Declined,${id},declined\n${id},Pending,${id},pending`,
        'utf8',
      ),
    })
    await page.getByRole('button', { name: 'Check file' }).click()
    await page.getByRole('button', { name: 'Import these guests' }).click()
    await expect(page.getByRole('status')).toContainText(/import complete/i)

    await page.goto('/dashboard/seating')
    // Seating a decline would put a place card in front of an empty chair.
    await expect(page.getByLabel(`Seat Coming ${id} at`)).toBeVisible()
    await expect(page.getByLabel(`Seat Declined ${id} at`)).toHaveCount(0)
    await expect(page.getByLabel(`Seat Pending ${id} at`)).toHaveCount(0)
  })

  test('a guest can be seated with the keyboard, not only by dragging', async ({
    page,
    accounts,
    id,
  }) => {
    await signIn(page, accounts.organiser)
    await addTable(page, id, 8)
    const guestName = await createAttendingGuest(page, id)

    await page.goto('/dashboard/seating')

    // The select is the mandatory keyboard path (docs/UX.md §3.3) — drag-only seating
    // would exclude keyboard and screen-reader users entirely.
    await seatGuest(page, guestName, id)

    await expect(seatOf(page, guestName)).toHaveText(id)
    await expect(occupancyOf(page, id)).toHaveText(/1\/8/)
  })

  test('the move is announced for screen readers', async ({ page, accounts, id }) => {
    await signIn(page, accounts.organiser)
    await addTable(page, id, 8)
    const guestName = await createAttendingGuest(page, id)

    await page.goto('/dashboard/seating')
    await page.getByLabel(`Seat ${guestName} at`).selectOption({ label: id })

    // dnd-kit adds its own role="status" live region, so target ours.
    const announcement = page.getByRole('status').filter({ hasText: guestName })
    await expect(announcement).toContainText(`${guestName} seated at ${id}`)
    await expect(announcement).toContainText('1 of 8 seats taken')
  })

  test('a guest can be returned to unassigned', async ({ page, accounts, id }) => {
    await signIn(page, accounts.organiser)
    await addTable(page, id, 8)
    const guestName = await createAttendingGuest(page, id)

    await page.goto('/dashboard/seating')
    await seatGuest(page, guestName, id)
    await expect(occupancyOf(page, id)).toHaveText(/1\/8/)

    await seatGuest(page, guestName, 'Unassigned')
    await expect(seatOf(page, guestName)).toHaveText('Unassigned')
    await expect(occupancyOf(page, id)).toHaveText(/0\/8/)
  })

  test('the seating survives a reload, so it reached the database', async ({
    page,
    accounts,
    id,
  }) => {
    await signIn(page, accounts.organiser)
    await addTable(page, id, 8)
    const guestName = await createAttendingGuest(page, id)

    await page.goto('/dashboard/seating')
    await seatGuest(page, guestName, id)
    await expect(occupancyOf(page, id)).toHaveText(/1\/8/)

    await page.reload()
    await expect(seatOf(page, guestName)).toHaveText(id)
    await expect(occupancyOf(page, id)).toHaveText(/1\/8/)
  })

  test('over capacity warns but is never refused', async ({ page, accounts, id }) => {
    await signIn(page, accounts.organiser)
    await addTable(page, id, 1)
    const guests = await createAttendingGuests(page, id, 2)

    await page.goto('/dashboard/seating')
    for (const guestName of guests) {
      await seatGuest(page, guestName, id)
    }

    // An organiser adding a chair knows their venue; the software warns, it does not block.
    await expect(occupancyOf(page, id)).toContainText('2/1')
    await expect(page.getByText(`${id} has 2 guests for 1 seats`)).toBeVisible()
  })

  test('deleting a table returns its guests to unassigned', async ({ page, accounts, id }) => {
    await signIn(page, accounts.organiser)
    await addTable(page, id, 8)
    const guestName = await createAttendingGuest(page, id)

    await page.goto('/dashboard/seating')
    await seatGuest(page, guestName, id)
    await expect(seatOf(page, guestName)).toHaveText(id)

    await page.getByRole('button', { name: `Remove ${id}` }).click()

    // Rather than leaving them pointing at a table that no longer exists.
    await expect(seatOf(page, guestName)).toHaveText('Unassigned')
  })

  test('a viewer cannot change the seating', async ({ page, accounts, id }) => {
    await signIn(page, accounts.viewer)
    await page.goto('/dashboard/seating')

    await page.getByLabel('Table name').fill(id)
    await page.getByRole('button', { name: 'Add table' }).click()

    await expect(page).toHaveURL(/denied=1/)
  })
})

test.describe('seating from the guest list', () => {
  test('the unassigned filter finds guests with no seat', async ({ page, accounts, id }) => {
    await signIn(page, accounts.organiser)
    await addTable(page, id, 8)
    const guests = await createAttendingGuests(page, id, 2)

    await page.goto('/dashboard/seating')
    await seatGuest(page, guests[0] ?? '', id)
    await expect(seatOf(page, guests[0] ?? '')).toHaveText(id)

    // The filter was a documented no-op until seating existed; now it is real.
    await page.goto(`/dashboard/guests?q=${id}&special=unassigned`)
    await expect(page.getByRole('link', { name: guests[1] ?? '' })).toBeVisible()
    await expect(page.getByRole('link', { name: guests[0] ?? '' })).toHaveCount(0)
  })

  test('bulk seating assigns several guests at once', async ({ page, accounts, id }) => {
    await signIn(page, accounts.organiser)
    await addTable(page, id, 8)
    await createAttendingGuests(page, id, 3)

    await page.goto(`/dashboard/guests?q=${id}`)
    await page.getByLabel('Select all guests on this page').check()
    await page.getByLabel('Seat selected guests at').selectOption({ label: id })
    await page.getByRole('button', { name: 'Seat', exact: true }).click()
    // Wait for the write to be confirmed rather than racing it with a navigation.
    await expect(page.getByRole('status').filter({ hasText: 'updated' })).toContainText(
      '3 guests updated',
    )

    await page.goto('/dashboard/seating')
    await expect(occupancyOf(page, id)).toHaveText(/3\/8/)
  })
})
