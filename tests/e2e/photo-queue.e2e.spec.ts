import { randomUUID } from 'node:crypto'

import type { Page } from '@playwright/test'

import type { TestAccount } from './support/accounts'
import { expect, test as base } from './support/fixtures'

/**
 * The photo queue is **one global run** for the wedding (ADR-001) — there is no
 * per-test queue to isolate, and two controllers driving it at once is precisely the
 * conflict the product guards against with optimistic concurrency. So this file takes
 * exclusive ownership of the queue and runs in a single project; WebKit's `EventSource`
 * is covered by `photo-queue-live.e2e.spec.ts`, which only reads.
 */
const test = base.extend<{ id: string }>({
  id: async ({ page }, use) => {
    const id = `T${randomUUID().slice(0, 8)}`
    await use(id)
    // Photo groups as well as parties: every test empties the queue before it starts,
    // so without this the last test in the file would leave its groups behind.
    await page.request
      .delete(`/api/photo-groups?where[name][contains]=${id}`)
      .catch(() => undefined)
    await page.request
      .delete(`/api/invitation-parties?where[displayName][contains]=${id}`)
      .catch(() => undefined)
  },
})

test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'The photo queue is a single global run and cannot be driven by two projects at once.',
)

async function signIn(page: Page, account: Pick<TestAccount, 'email' | 'password'>) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

/**
 * Empties the queue so a test starts from a known run.
 *
 * Unlike tables or guests, a photo group cannot be scoped to one test: the controller
 * always acts on whatever is at the front of the whole queue.
 */
async function emptyQueue(page: Page) {
  const response = await page.request.delete('/api/photo-groups?where[id][greater_than]=0')
  expect(response.ok()).toBeTruthy()
}

async function createGroups(page: Page, names: string[]) {
  for (const [index, name] of names.entries()) {
    const response = await page.request.post('/api/photo-groups', {
      data: { name, order: index, status: 'queued' },
    })
    expect(response.ok()).toBeTruthy()
  }
}

const region = (page: Page, name: string) => page.getByRole('region', { name })

/**
 * Presses a controller button and waits for the press to finish.
 *
 * Clicking again while the previous action is still settling dispatches the click at a
 * node React is in the middle of replacing, and the handler never runs — which looks
 * exactly like a button that does nothing.
 */
async function press(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).click()
  await expect(page.locator('[data-pending="false"]')).toBeVisible()
}

/** Creates attending guests in their own party and returns their display names. */
async function createAttendingGuests(
  page: Page,
  id: string,
  count: number,
  { withEmail = false }: { withEmail?: boolean } = {},
) {
  await page.goto('/dashboard/guests/import')
  const rows = Array.from(
    { length: count },
    (_, index) =>
      `${id},Photo${index},${id},adult,attending,${withEmail ? `photo${index}.${id}@example.test` : ''}`,
  ).join('\n')

  await page.getByLabel('CSV file').setInputFiles({
    name: 'guests.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(`party,firstName,lastName,ageGroup,rsvpStatus,email\n${rows}`, 'utf8'),
  })
  await page.getByRole('button', { name: 'Check file' }).click()
  await page.getByRole('button', { name: 'Import these guests' }).click()
  await expect(page.getByRole('status')).toContainText(/import complete/i)

  return Array.from({ length: count }, (_, index) => `Photo${index} ${id}`)
}

test.describe('planning the photographs', () => {
  test('an organiser can add a photograph to the running order', async ({ page, accounts, id }) => {
    await signIn(page, accounts.organiser)
    await emptyQueue(page)

    await page.goto('/dashboard/photos')
    await page.getByLabel('What the photographer will call out').fill(id)
    await page.getByLabel(/^Note/).fill('On the terrace steps')
    await page.getByLabel('Minutes').fill('6')
    await page.getByRole('button', { name: 'Add photograph' }).click()

    await expect(page.getByRole('heading', { level: 3, name: new RegExp(id) })).toBeVisible()
    await expect(page.getByText(/0 people · about 6 min · On the terrace steps/)).toBeVisible()
  })

  test('two photographs cannot share a name, so a call-out is never ambiguous', async ({
    page,
    accounts,
    id,
  }) => {
    await signIn(page, accounts.organiser)
    await emptyQueue(page)
    await createGroups(page, [id])

    await page.goto('/dashboard/photos')
    await page.getByLabel('What the photographer will call out').fill(id)
    await page.getByRole('button', { name: 'Add photograph' }).click()

    await expect(page.locator('form').getByRole('alert')).toContainText(/already a photograph/i)
  })

  test('the running order can be changed from the keyboard', async ({ page, accounts, id }) => {
    await signIn(page, accounts.organiser)
    await emptyQueue(page)
    await createGroups(page, [`${id} first`, `${id} second`])

    await page.goto('/dashboard/photos')
    const headings = page.getByRole('heading', { level: 3 })
    await expect(headings).toHaveText([`1.${id} first`, `2.${id} second`])

    // Buttons rather than drag-and-drop: reordering must not require a pointer.
    await page.getByRole('button', { name: `Move ${id} second earlier` }).click()
    await expect(headings).toHaveText([`1.${id} second`, `2.${id} first`])

    await page.getByRole('button', { name: `Move ${id} second later` }).click()
    await expect(headings).toHaveText([`1.${id} first`, `2.${id} second`])
  })

  test('a guest can be put in a photograph and taken out again', async ({ page, accounts, id }) => {
    await signIn(page, accounts.organiser)
    await emptyQueue(page)
    const [guest] = await createAttendingGuests(page, id, 1)
    await createGroups(page, [id])

    await page.goto('/dashboard/photos')
    await page.getByLabel(`Add someone to ${id}`).selectOption({ label: `${guest} — ${id}` })
    await page.getByRole('button', { name: 'Add', exact: true }).click()

    await expect(page.getByText('1 person')).toBeVisible()
    await expect(page.getByRole('button', { name: `Take ${guest} out of ${id}` })).toBeVisible()

    await page.getByRole('button', { name: `Take ${guest} out of ${id}` }).click()
    await expect(page.getByText(/Nobody added yet/)).toBeVisible()
  })

  test('deleting a photograph takes it out of the run', async ({ page, accounts, id }) => {
    await signIn(page, accounts.organiser)
    await emptyQueue(page)
    await createGroups(page, [id])

    await page.goto('/dashboard/photos')
    await page.getByRole('button', { name: `Remove the photograph ${id}` }).click()

    await expect(page.getByText(/No photographs yet/)).toBeVisible()
  })

  test('a viewer cannot change the running order', async ({ page, accounts, id }) => {
    await signIn(page, accounts.viewer)
    await page.goto('/dashboard/photos')

    await page.getByLabel('What the photographer will call out').fill(id)
    await page.getByRole('button', { name: 'Add photograph' }).click()

    await expect(page).toHaveURL(/denied=1/)
  })
})

test.describe('the wedding-day controller', () => {
  const names = (id: string) => [`${id} one`, `${id} two`, `${id} three`]

  async function openController(page: Page, id: string) {
    await emptyQueue(page)
    await createGroups(page, names(id))
    await page.goto('/dashboard/photos/run')
  }

  test('call next starts the run and moves it on', async ({ page, accounts, id }) => {
    await signIn(page, accounts.organiser)
    await openController(page, id)

    await expect(region(page, 'Now')).toContainText('Not started yet')
    await expect(region(page, 'Up next')).toContainText(`${id} one`)

    await press(page, 'Call next')
    await expect(region(page, 'Now')).toContainText(`${id} one`)
    await expect(region(page, 'Up next')).toContainText(`${id} two`)

    await press(page, 'Call next')
    await expect(region(page, 'Now')).toContainText(`${id} two`)
    await expect(page.locator(`li[data-queue-status="completed"]`)).toHaveCount(1)
  })

  test('complete ends a photograph without calling the next group over', async ({
    page,
    accounts,
    id,
  }) => {
    await signIn(page, accounts.organiser)
    await openController(page, id)

    await press(page, 'Call next')
    await expect(region(page, 'Now')).toContainText(`${id} one`)

    // The photographer pauses between groups; advancing here would have people stood
    // waiting in the sun.
    await press(page, 'Complete')
    await expect(region(page, 'Now')).toContainText('Not started yet')
    await expect(region(page, 'Up next')).toContainText(`${id} two`)
  })

  test('skip passes over a group that is not there', async ({ page, accounts, id }) => {
    await signIn(page, accounts.organiser)
    await openController(page, id)

    await press(page, 'Call next')
    await expect(region(page, 'Now')).toContainText(`${id} one`)

    await press(page, 'Skip')
    await expect(region(page, 'Now')).toContainText(`${id} two`)
    await expect(page.locator('li[data-queue-status="skipped"]')).toHaveCount(1)
  })

  test('previous brings back the photograph just taken', async ({ page, accounts, id }) => {
    await signIn(page, accounts.organiser)
    await openController(page, id)

    await press(page, 'Call next')
    await press(page, 'Call next')
    await expect(region(page, 'Now')).toContainText(`${id} two`)

    // Someone was missing and has now arrived — the commonest wedding-day correction.
    await press(page, 'Previous')
    await expect(region(page, 'Now')).toContainText(`${id} one`)
    await expect(region(page, 'Up next')).toContainText(`${id} two`)
  })

  test('the queue survives a reload, so it reached the database', async ({
    page,
    accounts,
    id,
  }) => {
    await signIn(page, accounts.organiser)
    await openController(page, id)

    await press(page, 'Call next')
    await expect(region(page, 'Now')).toContainText(`${id} one`)

    await page.reload()
    await expect(region(page, 'Now')).toContainText(`${id} one`)
  })

  test('a controller that has fallen behind is refused rather than double-advancing', async ({
    page,
    accounts,
    context,
    id,
  }) => {
    await signIn(page, accounts.organiser)
    await openController(page, id)

    // A second controller that never receives updates — the state a phone is in when the
    // venue wifi has quietly dropped it.
    const stale = await context.newPage()
    await stale.route('**/api/photo-queue**', (route) => route.abort())
    await stale.goto('/dashboard/photos/run')
    await expect(stale.getByRole('region', { name: 'Up next' })).toContainText(`${id} one`)

    await press(page, 'Call next')
    await expect(region(page, 'Now')).toContainText(`${id} one`)

    // Without the revision check this press would call group two, and group one would
    // never be photographed.
    await stale.getByRole('button', { name: 'Call next', exact: true }).click()
    await expect(stale.getByRole('status').filter({ hasText: /moved the queue/i })).toBeVisible()
    await expect(stale.getByRole('region', { name: 'Now' })).toContainText(`${id} one`)

    await stale.close()
  })
})

test.describe('the guest screen', () => {
  /** Creates a party of attending guests, puts them in a photograph, returns the link. */
  async function inviteGuestsInAPhotograph(page: Page, id: string) {
    await emptyQueue(page)
    const guests = await createAttendingGuests(page, id, 2)
    await createGroups(page, [`${id} theirs`, `${id} later`])

    const groups = await page.request.get(
      `/api/photo-groups?where[name][contains]=${id}&limit=10&depth=0`,
    )
    const groupId = (await groups.json()).docs.find((g: { name: string }) =>
      g.name.endsWith('theirs'),
    ).id

    const found = await page.request.get(
      `/api/guests?where[lastName][equals]=${id}&limit=10&depth=0`,
    )
    const guestIds = (await found.json()).docs.map((g: { id: number }) => g.id)

    await page.request.patch(`/api/photo-groups/${groupId}`, { data: { members: guestIds } })

    await page.goto('/dashboard/parties')
    await page.getByRole('link', { name: new RegExp(id) }).click()
    await page.getByRole('button', { name: /create invitation link/i }).click()
    const invitationUrl = await page.getByTestId('invitation-url').innerText()

    return { guests, token: invitationUrl.split('/invite/')[1] ?? '' }
  }

  test('a guest is told which photograph is theirs and how far away it is', async ({
    page,
    context,
    accounts,
    id,
  }) => {
    await signIn(page, accounts.organiser)
    const { token } = await inviteGuestsInAPhotograph(page, id)

    const guestPage = await context.newPage()
    await guestPage.goto(`/photos/${token}`)

    await expect(guestPage.getByRole('region', { name: 'Your photo' })).toContainText(
      `${id} theirs`,
    )
    await expect(guestPage.getByText('You are next — start making your way over.')).toBeVisible()

    // Called over: the wording changes with proximity (docs/UX.md §4.2).
    await page.goto('/dashboard/photos/run')
    await press(page, 'Call next')
    await expect(guestPage.getByText('You are being photographed now.')).toBeVisible()

    await guestPage.close()
  })

  test('the guest screen updates without a reload when the organiser calls the next group', async ({
    page,
    context,
    accounts,
    id,
  }) => {
    await signIn(page, accounts.organiser)
    await emptyQueue(page)
    await createGroups(page, [`${id} one`, `${id} two`])

    const guestPage = await context.newPage()
    await guestPage.goto('/photos')
    await expect(guestPage.getByRole('region', { name: 'Now' })).toContainText(
      'Photographs have not started',
    )
    // The stream is connected before the organiser acts, so what follows is the event
    // arriving — not a page load.
    await expect(guestPage.locator('[data-connection="live"]')).toBeVisible()

    await page.goto('/dashboard/photos/run')
    await press(page, 'Call next')

    await expect(guestPage.getByRole('region', { name: 'Now' })).toContainText(`${id} one`)
    await expect(guestPage.getByRole('region', { name: 'Up next' })).toContainText(`${id} two`)

    await guestPage.close()
  })

  test('the queue recovers on its own after the connection drops', async ({
    page,
    context,
    accounts,
    id,
  }) => {
    await signIn(page, accounts.organiser)
    await emptyQueue(page)
    await createGroups(page, [`${id} one`, `${id} two`])

    // Its own context: taking the guest offline must not take the organiser with them.
    const guestContext = await context.browser()!.newContext()
    const guestPage = await guestContext.newPage()
    await guestPage.goto('/photos')
    await expect(guestPage.locator('[data-connection="live"]')).toBeVisible()

    // Venue wifi, mid-ceremony.
    await guestContext.setOffline(true)
    await page.goto('/dashboard/photos/run')
    await press(page, 'Call next')

    await guestContext.setOffline(false)

    // No reload: the client reconnects and is handed the current state, rather than
    // replaying the events it missed (ADR-006).
    await expect(guestPage.getByRole('region', { name: 'Now' })).toContainText(`${id} one`, {
      timeout: 30_000,
    })

    await guestContext.close()
  })

  test('an unknown token is refused', async ({ page }) => {
    const response = await page.goto(`/photos/${'a'.repeat(43)}`)
    expect(response?.status()).toBe(404)
  })
})

test.describe('what the photo queue never reveals', () => {
  test('the public queue carries the running order but never who is in it', async ({
    page,
    context,
    accounts,
    id,
  }) => {
    await signIn(page, accounts.organiser)
    await emptyQueue(page)
    const guests = await createAttendingGuests(page, id, 1)
    await createGroups(page, [id])

    const found = await page.request.get(`/api/guests?where[lastName][equals]=${id}&limit=10`)
    const guestIds = (await found.json()).docs.map((g: { id: number }) => g.id)
    const groups = await page.request.get(`/api/photo-groups?where[name][equals]=${id}&limit=1`)
    const groupId = (await groups.json()).docs[0].id
    await page.request.patch(`/api/photo-groups/${groupId}`, { data: { members: guestIds } })

    const anonymous = await context.browser()!.newContext()
    const guestPage = await anonymous.newPage()

    await guestPage.goto('/photos')
    await expect(guestPage.getByRole('region', { name: 'Up next' })).toContainText(id)
    // The group name is public; its members are not.
    expect(await guestPage.content()).not.toContain(guests[0] ?? 'Photo0')

    const snapshot = await anonymous.request.get('/api/photo-queue')
    const body = await snapshot.text()
    expect(body).toContain(id)
    expect(body).not.toContain('memberIds')
    expect(body).not.toContain('members')
    expect(body).not.toContain(guests[0]?.split(' ')[0] ?? 'Photo0')

    await anonymous.close()
  })

  test('the photo groups collection is closed to anonymous requests', async ({ browser }) => {
    // Who is in which photograph is a guest directory by another name.
    const anonymous = await browser.newContext()
    const response = await anonymous.request.get('/api/photo-groups', { failOnStatusCode: false })

    expect(response.status()).toBeGreaterThanOrEqual(400)
    await anonymous.close()
  })

  test('the controller is not reachable without signing in', async ({ browser }) => {
    const anonymous = await browser.newContext()
    const page = await anonymous.newPage()

    await page.goto('/dashboard/photos/run')
    await expect(page).toHaveURL(/\/login/)

    await anonymous.close()
  })
})

test.describe('telling guests their photograph is coming up', () => {
  /** Puts `count` attending guests into a photograph at the front of the run. */
  async function stageGroup(page: Page, id: string, count: number, withEmail: boolean) {
    await emptyQueue(page)
    await createAttendingGuests(page, id, count, { withEmail })
    await createGroups(page, [`${id} first`, `${id} second`])

    const groups = await page.request.get(`/api/photo-groups?where[name][contains]=${id}&limit=10`)
    const first = (await groups.json()).docs.find((group: { name: string }) =>
      group.name.endsWith('first'),
    )

    const guests = await page.request.get(`/api/guests?where[lastName][equals]=${id}&limit=10`)
    const guestIds = (await guests.json()).docs.map((guest: { id: number }) => guest.id)

    await page.request.patch(`/api/photo-groups/${first.id}`, { data: { members: guestIds } })
  }

  test('calling a group queues a message for everyone in it', async ({ page, accounts, id }) => {
    await signIn(page, accounts.organiser)
    await stageGroup(page, id, 2, true)

    await page.goto('/dashboard/photos/run')
    await press(page, 'Call next')

    await expect(page.getByRole('status').filter({ hasText: 'messaged' })).toContainText(
      '2 guests messaged',
    )

    // Sending happens after the response, so the page shows it once the work has run.
    await page.goto('/dashboard/notifications')
    await expect(page.getByRole('row').filter({ hasText: `Photo0 ${id}` })).toContainText(
      'photo.now',
    )
  })

  test('the message is really sent, after the organiser’s response has gone out', async ({
    page,
    accounts,
    id,
  }) => {
    await signIn(page, accounts.organiser)
    await stageGroup(page, id, 1, true)

    await page.goto('/dashboard/photos/run')
    await press(page, 'Call next')
    await expect(page.getByRole('status').filter({ hasText: 'messaged' })).toBeVisible()

    // Delivery deliberately happens *after* the response, so this polls the record rather
    // than assuming the send has already run. In development and CI the provider is the
    // console one — no network, no cost, nobody actually messaged.
    await expect
      .poll(
        async () => {
          const rows = await page.request.get('/api/notifications?limit=20&sort=-createdAt')
          const docs = (await rows.json()).docs as { body: string; status: string }[]
          return docs.find((row) => row.body.includes(`${id} first`))?.status
        },
        { timeout: 15_000 },
      )
      .toBe('sent')
  })

  test('a guest with no way to be reached is reported, not silently skipped', async ({
    page,
    accounts,
    id,
  }) => {
    await signIn(page, accounts.organiser)
    await stageGroup(page, id, 1, false)

    await page.goto('/dashboard/photos/run')
    await press(page, 'Call next')

    // Someone now has to go and find them, so this stays on screen rather than being
    // announced once.
    await expect(page.getByText(/no way to be messaged/i)).toBeVisible()
  })

  test('stepping back and re-calling does not message anyone twice', async ({
    page,
    accounts,
    id,
  }) => {
    await signIn(page, accounts.organiser)
    await stageGroup(page, id, 1, true)

    await page.goto('/dashboard/photos/run')
    await press(page, 'Call next')
    await expect(page.getByRole('status').filter({ hasText: 'messaged' })).toContainText(
      '1 guest messaged',
    )

    await press(page, 'Call next')
    await expect(region(page, 'Now')).toContainText(`${id} second`)
    await press(page, 'Previous')
    await expect(region(page, 'Now')).toContainText(`${id} first`)

    // The unique dedupe key refuses the repeat, so nobody is texted twice about the same
    // photograph.
    const rows = await page.request.get(
      `/api/notifications?where[type][equals]=photo.now&limit=100&depth=1`,
    )
    const forThisGuest = (await rows.json()).docs.filter((row: { body: string }) =>
      row.body.includes(`${id} first`),
    )
    expect(forThisGuest).toHaveLength(1)
  })

  test('the group after the current one is warned that it is next', async ({
    page,
    accounts,
    id,
  }) => {
    await signIn(page, accounts.organiser)
    await stageGroup(page, id, 1, true)

    // The same guest is in the second photograph too, so one press produces both
    // messages: "you are up now" for the group being taken, "you are next" for the one
    // after it.
    const groups = await page.request.get(`/api/photo-groups?where[name][contains]=${id}&limit=10`)
    const second = (await groups.json()).docs.find((group: { name: string }) =>
      group.name.endsWith('second'),
    )
    const guests = await page.request.get(`/api/guests?where[lastName][equals]=${id}&limit=10`)
    const guestIds = (await guests.json()).docs.map((guest: { id: number }) => guest.id)
    await page.request.patch(`/api/photo-groups/${second.id}`, { data: { members: guestIds } })

    await page.goto('/dashboard/photos/run')
    await press(page, 'Call next')
    // The click only dispatches the action; reading the record before it has finished
    // would be racing the server.
    await expect(page.getByRole('status').filter({ hasText: 'messaged' })).toBeVisible()

    const rows = await page.request.get('/api/notifications?limit=20&sort=-createdAt')
    const bodies = (await rows.json()).docs.map((row: { body: string }) => row.body)

    expect(bodies.some((body: string) => body.includes('start making your way over'))).toBe(true)
    expect(bodies.some((body: string) => body.includes('photographer is ready'))).toBe(true)
  })
})
