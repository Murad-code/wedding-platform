import { randomUUID } from 'node:crypto'

import type { Page } from '@playwright/test'

import { expect, test } from './support/fixtures'
import type { TestAccount, WorkerAccounts } from './support/accounts'

/**
 * The first end-to-end milestone (docs/PRODUCT_SPEC.md §6):
 * organiser creates a party → invitation is generated → guest RSVPs →
 * organiser sees the response → a wrong token is refused.
 */

async function signIn(page: Page, account: Pick<TestAccount, 'email' | 'password'>) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

/**
 * Date.now() collides when parallel tests start in the same millisecond, which produced
 * duplicate party names and ambiguous locators.
 */
function uniqueName(prefix: string) {
  return `${prefix} ${randomUUID().slice(0, 8)}`
}

async function addGuest(page: Page, firstName: string, lastName: string) {
  await page.getByLabel('First name').fill(firstName)
  await page.getByLabel('Last name').fill(lastName)
  await page.getByRole('button', { name: 'Add guest' }).click()
  await expect(page.getByText(`${firstName} ${lastName}`)).toBeVisible()
}

/** Creates a party with two guests and returns its invitation URL and party page URL. */
async function createPartyWithInvitation(page: Page, accounts: WorkerAccounts, partyName: string) {
  await signIn(page, accounts.organiser)

  await page.goto('/dashboard/parties')
  await page.getByLabel('Party name').fill(partyName)
  await page.getByRole('button', { name: 'Add party' }).click()

  // Creating a party lands on it, so the organiser can add people immediately.
  await expect(page.getByRole('heading', { name: partyName })).toBeVisible()
  const partyUrl = page.url()
  expect(partyUrl).toMatch(/\/dashboard\/parties\/\d+$/)

  await addGuest(page, 'Murad', 'Kamali')
  await addGuest(page, 'Priya', 'Kamali')

  await page.getByRole('button', { name: /create invitation link/i }).click()
  const invitationUrl = await page.getByTestId('invitation-url').innerText()

  return { invitationUrl, partyUrl }
}

test.describe('invitation and RSVP', () => {
  test('an organiser creates a party, a guest RSVPs, and the organiser sees it', async ({
    page,
    context,
    accounts,
  }) => {
    const partyName = uniqueName('The Kamali Family')
    const { invitationUrl, partyUrl } = await createPartyWithInvitation(page, accounts, partyName)

    expect(invitationUrl).toMatch(/\/invite\/[A-Za-z0-9_-]{43}$/)
    // The URL must not leak a database id or a guest's name.
    expect(invitationUrl).not.toContain('Kamali')

    // A brand-new browser context: the guest has no organiser session, only the link.
    const guestPage = await context.browser()!.newPage()
    await guestPage.goto(invitationUrl)

    await expect(guestPage.getByRole('heading', { name: /you’re invited/i })).toBeVisible()
    await expect(guestPage.getByText(partyName)).toBeVisible()
    await expect(guestPage.getByText('Murad Kamali')).toBeVisible()
    await expect(guestPage.getByText('Priya Kamali')).toBeVisible()

    // Partial household attendance: one attends, one declines.
    await guestPage
      .getByRole('group', { name: 'Murad Kamali' })
      .getByText('Joyfully accepts')
      .click()
    await guestPage
      .getByRole('group', { name: 'Priya Kamali' })
      .getByText('Regretfully declines')
      .click()

    // Dietary details are only asked of the attending guest.
    await guestPage.getByLabel('Dietary requirements').fill('Vegetarian')

    await guestPage.getByRole('button', { name: /send our response/i }).click()
    await expect(guestPage.getByRole('status')).toContainText(/thank you/i)

    await guestPage.close()

    // The organiser sees the responses.
    await page.goto(partyUrl)
    await expect(page.locator('[data-rsvp-status="attending"]')).toHaveCount(1)
    await expect(page.locator('[data-rsvp-status="declined"]')).toHaveCount(1)
    await expect(page.getByText('Vegetarian')).toBeVisible()

    // And the dashboard totals reflect it.
    await page.goto('/dashboard')
    await expect(page.getByText('Guests invited')).toBeVisible()
  })

  test('a guest can edit their response before the deadline', async ({
    page,
    context,
    accounts,
  }) => {
    const partyName = uniqueName('Editable Party')
    const { invitationUrl } = await createPartyWithInvitation(page, accounts, partyName)

    const guestPage = await context.browser()!.newPage()
    await guestPage.goto(invitationUrl)

    await guestPage
      .getByRole('group', { name: 'Murad Kamali' })
      .getByText('Joyfully accepts')
      .click()
    await guestPage.getByRole('button', { name: /send our response/i }).click()
    await expect(guestPage.getByRole('status')).toBeVisible()

    // Saving triggers a router refresh; wait for it to land before navigating again,
    // otherwise the explicit goto races the in-flight refresh.
    await expect(guestPage.getByRole('button', { name: /update our response/i })).toBeVisible()

    // Returning to the link shows the saved answer, not a blank form.
    await guestPage.goto(invitationUrl)
    await expect(guestPage.getByRole('button', { name: /update our response/i })).toBeVisible()

    await guestPage
      .getByRole('group', { name: 'Murad Kamali' })
      .getByText('Regretfully declines')
      .click()
    await guestPage.getByRole('button', { name: /update our response/i }).click()
    await expect(guestPage.getByRole('status')).toBeVisible()

    await guestPage.close()
  })

  test('issuing a new link immediately invalidates the previous one', async ({
    page,
    context,
    accounts,
  }) => {
    const partyName = uniqueName('Rotating Party')
    const { invitationUrl, partyUrl } = await createPartyWithInvitation(page, accounts, partyName)

    await page.goto(partyUrl)
    await page.getByRole('button', { name: /create a new link/i }).click()
    const newUrl = await page.getByTestId('invitation-url').innerText()
    expect(newUrl).not.toBe(invitationUrl)

    const guestPage = await context.browser()!.newPage()

    // The old link is dead...
    await guestPage.goto(invitationUrl)
    await expect(
      guestPage.getByRole('heading', { name: /couldn’t find that invitation/i }),
    ).toBeVisible()

    // ...and the new one works.
    await guestPage.goto(newUrl)
    await expect(guestPage.getByRole('heading', { name: /you’re invited/i })).toBeVisible()

    await guestPage.close()
  })
})

test.describe('invitation token security', () => {
  test('an unknown token is refused', async ({ page }) => {
    await page.goto(`/invite/${'a'.repeat(43)}`)
    await expect(
      page.getByRole('heading', { name: /couldn’t find that invitation/i }),
    ).toBeVisible()
  })

  test('a malformed token is refused without leaking the reason', async ({ page }) => {
    for (const token of ['short', '../../etc/passwd', "'%20OR%201=1--"]) {
      await page.goto(`/invite/${encodeURIComponent(token)}`)
      await expect(
        page.getByRole('heading', { name: /couldn’t find that invitation/i }),
      ).toBeVisible()
    }
  })

  test('unknown and malformed tokens are indistinguishable', async ({ page }) => {
    await page.goto(`/invite/${'a'.repeat(43)}`)
    const unknown = await page.getByRole('main').innerText()

    await page.goto('/invite/short')
    const malformed = await page.getByRole('main').innerText()

    // No oracle: a probe cannot tell "never existed" from "wrong shape".
    expect(unknown).toBe(malformed)
  })

  test('the RSVP endpoint refuses a bad token', async ({ request }) => {
    const response = await request.post('/api/rsvp', {
      data: {
        token: 'a'.repeat(43),
        guests: [{ guestId: 1, rsvpStatus: 'attending' }],
      },
    })
    expect(response.status()).toBe(404)
  })

  test('the RSVP endpoint refuses guests from another party', async ({
    page,
    request,
    accounts,
  }) => {
    const { invitationUrl } = await createPartyWithInvitation(page, accounts, uniqueName('Party A'))
    const token = invitationUrl.split('/invite/')[1]

    // A valid token, but a guest id that does not belong to it. The token proves which
    // party you are, not which guests you may write.
    const response = await request.post('/api/rsvp', {
      data: {
        token,
        guests: [{ guestId: 999_999, rsvpStatus: 'attending' }],
      },
    })
    expect(response.status()).toBe(400)
  })

  test('the invitation page is not indexable and sends no referrer', async ({ page }) => {
    const response = await page.goto(`/invite/${'a'.repeat(43)}`)
    const headers = response!.headers()

    // The URL is the credential, so it must not reach search engines or referrers.
    expect(headers['x-robots-tag']).toContain('noindex')
    expect(headers['referrer-policy']).toBe('no-referrer')

    // Never cacheable by a shared cache. Next sends the full
    // `private, no-store, max-age=0, must-revalidate` for dynamic pages in production
    // but only `no-cache, must-revalidate` in dev, so assert the invariant that holds
    // in both rather than pinning a dev-only string.
    const cacheControl = headers['cache-control'] ?? ''
    expect(cacheControl).toMatch(/no-cache|no-store/)
    expect(cacheControl).not.toContain('public')
    expect(cacheControl).not.toContain('s-maxage')
  })

  test('invitation parties are not readable anonymously', async ({ request }) => {
    // No enumerable guest directory (docs/SECURITY.md §3).
    expect((await request.get('/api/invitation-parties')).status()).toBe(403)
    expect((await request.get('/api/guests')).status()).toBe(403)
  })

  test('the token hash is never returned by the API', async ({ request, accounts }) => {
    const login = await request.post('/api/users/login', {
      data: {
        email: accounts.organiser.email,
        password: accounts.organiser.password,
      },
    })
    expect(login.ok()).toBe(true)

    const body = await (await request.get('/api/invitation-parties?limit=5')).text()
    expect(body).not.toContain('tokenHash')
  })
})
