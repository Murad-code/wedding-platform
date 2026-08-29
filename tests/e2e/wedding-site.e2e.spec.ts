import { randomUUID } from 'node:crypto'

import type { Page } from '@playwright/test'

import type { TestAccount } from './support/accounts'
import { expect, test as base } from './support/fixtures'

/**
 * Itinerary items and contacts are shared, guest-visible content. A test that fails
 * partway would otherwise leave its row on the real wedding site, so the id is handed
 * out by a fixture that removes anything carrying it afterwards — cleanup that runs even
 * when the test itself does not reach its own delete step.
 */
const test = base.extend<{ id: string }>({
  id: async ({ page }, use) => {
    const id = `T${randomUUID().slice(0, 8)}`
    await use(id)
    await Promise.all([
      page.request
        .delete(`/api/itinerary-items?where[title][contains]=${id}`)
        .catch(() => undefined),
      page.request
        .delete(`/api/wedding-contacts?where[name][contains]=${id}`)
        .catch(() => undefined),
    ])
  },
})

async function signIn(page: Page, account: Pick<TestAccount, 'email' | 'password'>) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

test.describe('wedding website', () => {
  test('the landing page shows the couple, the date, and a countdown', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Sarah')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Adam')
    await expect(page.getByText('Saturday, 12 June 2027')).toBeVisible()

    // The countdown is client-rendered; it should arrive without a reload.
    await expect(page.getByLabel('Time until the wedding')).toBeVisible()
    await expect(page.getByText('days', { exact: true })).toBeVisible()
  })

  test('times render in the wedding timezone, not the browser’s', async ({ browser }) => {
    // A guest in New York must see the ceremony time the couple meant.
    const context = await browser.newContext({ timezoneId: 'America/New_York' })
    const page = await context.newPage()

    await page.goto('/our-day')
    // 13:00Z is 2:00 pm in British Summer Time, and must read that way in New York too.
    await expect(page.getByText('2:00 pm').first()).toBeVisible()

    await context.close()
  })

  test('a guest can navigate the whole site', async ({ page }) => {
    await page.goto('/')

    for (const [label, heading] of [
      ['Our day', 'Our day'],
      ['Venue & travel', 'Venue & travel'],
      ['FAQs', 'Questions'],
      ['Contact', 'Get in touch'],
      ['RSVP', 'RSVP'],
    ] as const) {
      await page.goto('/')
      await page.getByRole('link', { name: label }).click()
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
    }
  })

  test('the RSVP page explains the private link and offers no guest lookup', async ({ page }) => {
    await page.goto('/rsvp')

    await expect(page.getByText(/private link/i)).toBeVisible()
    // A guest-name search would be an enumeration route into the guest list.
    await expect(page.locator('input[type="search"]')).toHaveCount(0)
    await expect(page.getByRole('textbox')).toHaveCount(0)
  })

  test('the venue page shows travel, parking, and accommodation', async ({ page }) => {
    await page.goto('/venue')

    await expect(page.getByRole('heading', { name: 'Getting there' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Parking' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Where to stay' })).toBeVisible()
  })

  test('contact links are dialable and reach a real touch target', async ({ page }) => {
    await page.goto('/contact')

    const call = page.getByRole('link', { name: /^Call / }).first()
    await expect(call).toHaveAttribute('href', /^tel:\+?\d+$/)

    // 44px minimum touch target (docs/UX.md §6).
    const box = await call.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
  })

  test('the guest site is not a CMS — no ids or admin vocabulary leak', async ({ page }) => {
    for (const path of ['/', '/our-day', '/venue', '/faqs', '/contact']) {
      await page.goto(path)
      const text = await page.locator('body').innerText()
      expect(text.toLowerCase()).not.toContain('collection')
      expect(text.toLowerCase()).not.toContain('payload')
    }
  })
})

test.describe('itinerary visibility', () => {
  test('internal items never reach the public site', async ({ page }) => {
    await page.goto('/our-day')

    const html = await page.content()
    // Supplier timings are filtered server-side, so they are not even in the payload.
    expect(html).not.toContain('Florist arrives')
    await expect(page.getByText('Ceremony').first()).toBeVisible()
  })

  test('guests-only items are hidden from the public site', async ({ page }) => {
    await page.goto('/our-day')
    expect(await page.content()).not.toContain('Speeches')
  })

  test('guests-only items appear on a personal invitation', async ({ page, accounts, id }) => {
    await signIn(page, accounts.organiser)

    await page.goto('/dashboard/parties')
    await page.getByLabel('Party name').fill(id)
    await page.getByRole('button', { name: 'Add party' }).click()
    await expect(page.getByRole('heading', { name: id })).toBeVisible()

    await page.getByLabel('First name').fill('Timeline')
    await page.getByLabel('Last name').fill(id)
    await page.getByRole('button', { name: 'Add guest' }).click()
    await expect(page.getByText(`Timeline ${id}`)).toBeVisible()

    await page.getByRole('button', { name: /create invitation link/i }).click()
    const invitationUrl = await page.getByTestId('invitation-url').innerText()

    await page.goto(invitationUrl)
    // An invited guest sees public *and* guests-only items...
    await expect(page.getByText('Speeches')).toBeVisible()
    await expect(page.getByText('Ceremony').first()).toBeVisible()
    // ...but still never the internal ones.
    expect(await page.content()).not.toContain('Florist arrives')
  })
})

test.describe('organiser content editing', () => {
  test('the wedding settings page loads and is linked from the dashboard', async ({
    page,
    accounts,
  }) => {
    await signIn(page, accounts.organiser)

    await page.getByRole('link', { name: 'Wedding settings' }).click()
    await expect(page).toHaveURL(/\/dashboard\/settings/)
    await expect(page.getByRole('heading', { level: 1, name: 'Wedding settings' })).toBeVisible()
    await expect(page.getByLabel('First name')).toHaveValue('Sarah')
  })

  test('an invalid timezone is rejected server-side', async ({ page, accounts }) => {
    await signIn(page, accounts.organiser)
    await page.goto('/dashboard/settings')

    await page.getByLabel('Timezone').fill('Not/AZone')
    await page.getByRole('button', { name: 'Save settings' }).click()

    // An unrecognised IANA name would make every date on the guest site throw.
    await expect(page.locator('form').getByRole('alert')).toContainText(/timezone/i)
  })

  test('a map link must be a URL', async ({ page, accounts }) => {
    await signIn(page, accounts.organiser)
    await page.goto('/dashboard/settings')

    await page.getByLabel('Map link').first().fill('javascript:alert(1)')
    await page.getByRole('button', { name: 'Save settings' }).click()

    await expect(page.locator('form').getByRole('alert')).toContainText(/http/i)
  })

  test('a viewer cannot change the wedding settings', async ({ page, accounts }) => {
    await signIn(page, accounts.viewer)
    await page.goto('/dashboard/settings')

    await page.getByLabel('Dress code').fill('Changed by a viewer')
    await page.getByRole('button', { name: 'Save settings' }).click()

    await expect(page).toHaveURL(/denied=1/)
  })

  test('an organiser can add and remove an itinerary item', async ({ page, accounts, id }) => {
    await signIn(page, accounts.organiser)
    await page.goto('/dashboard/itinerary')

    await page.getByLabel('What is happening').fill(id)
    await page.getByLabel('Who can see it').selectOption('public')
    await page.getByRole('button', { name: 'Add to the day' }).click()
    await expect(page.getByRole('listitem').filter({ hasText: id })).toBeVisible()

    await page.goto('/our-day')
    await expect(page.getByText(id)).toBeVisible()

    await page.goto('/dashboard/itinerary')
    await page.getByRole('button', { name: `Remove ${id}` }).click()
    await expect(page.getByRole('listitem').filter({ hasText: id })).toHaveCount(0)
  })

  test('a hidden contact is never sent to the guest page', async ({ page, accounts, id }) => {
    await signIn(page, accounts.organiser)
    await page.goto('/dashboard/contacts')

    await page.getByLabel('Name').fill(id)
    await page.getByLabel('Phone').fill('+44 7700 900555')
    // Left unchecked: internal by default.
    await page.getByRole('button', { name: 'Add contact' }).click()
    await expect(page.getByRole('listitem').filter({ hasText: id })).toBeVisible()

    await page.goto('/contact')
    // Filtered server-side, so the number is not in the HTML at all.
    expect(await page.content()).not.toContain(id)
    expect(await page.content()).not.toContain('900555')
  })

  test('making a contact visible publishes it', async ({ page, accounts, id }) => {
    await signIn(page, accounts.organiser)
    await page.goto('/dashboard/contacts')

    await page.getByLabel('Name').fill(id)
    await page.getByLabel('Show this contact on the guest website').check()
    await page.getByRole('button', { name: 'Add contact' }).click()

    // Wait for the save to land before navigating; otherwise the goto races the
    // server action and the contact legitimately does not exist yet.
    await expect(page.getByRole('listitem').filter({ hasText: id })).toBeVisible()

    await page.goto('/contact')
    await expect(page.getByRole('listitem').filter({ hasText: id }).first()).toBeVisible()
  })
})
