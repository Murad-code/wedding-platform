import { randomUUID } from 'node:crypto'

import type { Page } from '@playwright/test'

import type { TestAccount } from './support/accounts'
import { expect, test as base } from './support/fixtures'

/**
 * Every test here writes to the *same* menu — unlike guests, a course cannot be scoped
 * away by name alone, because each one is rendered on a page every other test loads.
 * Without cleanup the menu grows run after run until that shared page is slow enough to
 * time out its neighbours. The fixture hands out a unique id and removes anything
 * carrying it afterwards.
 */
const test = base.extend<{ id: string }>({
  id: async ({ page }, use) => {
    const id = `T${randomUUID().slice(0, 8)}`
    await use(id)
    await page.request
      .delete(`/api/menu-courses?where[name][contains]=${id}`)
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
 * Option names appear in three places on the menu page — the course list, the Remove
 * button's accessible name, and the tally. Scoping to the labelled region keeps each
 * assertion about the thing it actually means.
 */
const coursesRegion = (page: Page) => page.getByRole('region', { name: 'Courses' })

/**
 * One course's card. Tests run in parallel against a single shared menu, so every
 * locator must name its own course — reaching for "the last one on the page" picks up
 * whatever another test happened to add.
 */
const courseCard = (page: Page, courseName: string) =>
  coursesRegion(page).locator('article').filter({ hasText: courseName })

/** The list row for one option, which is unambiguous where the bare name is not. */
const optionRow = (page: Page, option: string) =>
  coursesRegion(page).getByRole('listitem').filter({ hasText: option })
const tallyRegion = (page: Page) => page.getByRole('region', { name: 'Choices so far' })

/** Creates a course with two options and returns its name. */
async function createCourse(page: Page, name: string, options: string[], childrenOnly = false) {
  await page.goto('/dashboard/menu')
  await page.getByLabel('Course name').fill(name)
  if (childrenOnly) await page.getByLabel('Children only').check()
  await page.getByRole('button', { name: 'Add course' }).click()
  await expect(page.getByRole('heading', { level: 3, name })).toBeVisible()

  for (const option of options) {
    await page.getByLabel(`Add an option to ${name}`).fill(option)
    await courseCard(page, name).getByRole('button', { name: 'Add', exact: true }).click()
    await expect(optionRow(page, option)).toBeVisible()
  }
}

/** Creates a party with one guest and returns the invitation URL. */
async function createInvitedGuest(page: Page, id: string, ageGroup?: 'child') {
  await page.goto('/dashboard/parties')
  await page.getByLabel('Party name').fill(id)
  await page.getByRole('button', { name: 'Add party' }).click()
  await expect(page.getByRole('heading', { name: id })).toBeVisible()

  await page.getByLabel('First name').fill('Eater')
  await page.getByLabel('Last name').fill(id)
  if (ageGroup) await page.getByLabel('Age group').selectOption(ageGroup)
  await page.getByRole('button', { name: 'Add guest' }).click()
  await expect(page.getByText(`Eater ${id}`)).toBeVisible()

  await page.getByRole('button', { name: /create invitation link/i }).click()
  return page.getByTestId('invitation-url').innerText()
}

test.describe('menu configuration', () => {
  test('an organiser can add a course and options', async ({ page, accounts, id }) => {
    await signIn(page, accounts.organiser)

    await createCourse(page, id, [`${id} beef`, `${id} salmon`])

    await expect(page.getByRole('heading', { level: 3, name: id })).toBeVisible()
    await expect(optionRow(page, `${id} beef`)).toBeVisible()
  })

  test('a course with no options warns that guests cannot choose it', async ({
    page,
    accounts,
    id,
  }) => {
    await signIn(page, accounts.organiser)

    await page.goto('/dashboard/menu')
    await page.getByLabel('Course name').fill(id)
    await page.getByRole('button', { name: 'Add course' }).click()

    await expect(page.getByText(/guests cannot choose this course/i).first()).toBeVisible()
  })

  test('the public menu page lists the courses', async ({ page, accounts, id }) => {
    await signIn(page, accounts.organiser)
    await createCourse(page, id, [`${id} beef`])

    await page.goto('/menu')
    await expect(page.getByRole('heading', { name: id })).toBeVisible()
    await expect(page.getByText(`${id} beef`)).toBeVisible()
  })

  test('a viewer cannot change the menu', async ({ page, accounts, id }) => {
    await signIn(page, accounts.viewer)
    await page.goto('/dashboard/menu')

    await page.getByLabel('Course name').fill(id)
    await page.getByRole('button', { name: 'Add course' }).click()

    await expect(page).toHaveURL(/denied=1/)
  })

  test('removing a course removes its options too', async ({ page, accounts, id }) => {
    await signIn(page, accounts.organiser)
    await createCourse(page, id, [`${id} beef`])

    await page.getByRole('button', { name: `Remove ${id}`, exact: true }).click()

    await expect(page.getByRole('heading', { level: 3, name: id })).toHaveCount(0)
    // The option went with it, rather than being orphaned.
    await expect(optionRow(page, `${id} beef`)).toHaveCount(0)
    await expect(tallyRegion(page).getByText(`${id} beef`, { exact: true })).toHaveCount(0)
  })
})

test.describe('guests choosing meals', () => {
  test('a guest chooses a meal and the organiser sees the tally', async ({
    page,
    context,
    accounts,
    id,
  }) => {
    await signIn(page, accounts.organiser)
    await createCourse(page, id, [`${id} beef`, `${id} salmon`])

    const invitationUrl = await createInvitedGuest(page, id)

    const guestPage = await context.browser()!.newPage()
    await guestPage.goto(invitationUrl)

    await guestPage
      .getByRole('group', { name: `Eater ${id}` })
      .getByText('Joyfully accepts')
      .click()
    await guestPage.getByText(`${id} beef`, { exact: true }).click()
    await guestPage.getByRole('button', { name: /send our response/i }).click()
    await expect(guestPage.getByRole('status')).toContainText(/thank you/i)
    await guestPage.close()

    await page.goto('/dashboard/menu')
    // Exactly one taker for the beef.
    await expect(
      tallyRegion(page)
        .getByRole('listitem')
        .filter({ hasText: `${id} beef` }),
    ).toContainText('1')
  })

  test('a guest can change their choice, and the old one is replaced', async ({
    page,
    context,
    accounts,
    id,
  }) => {
    await signIn(page, accounts.organiser)
    await createCourse(page, id, [`${id} beef`, `${id} salmon`])
    const invitationUrl = await createInvitedGuest(page, id)

    const guestPage = await context.browser()!.newPage()
    await guestPage.goto(invitationUrl)
    await guestPage
      .getByRole('group', { name: `Eater ${id}` })
      .getByText('Joyfully accepts')
      .click()
    await guestPage.getByText(`${id} beef`, { exact: true }).click()
    await guestPage.getByRole('button', { name: /send our response/i }).click()
    await expect(guestPage.getByRole('status')).toBeVisible()

    // Change of heart.
    await guestPage.goto(invitationUrl)
    await guestPage.getByText(`${id} salmon`, { exact: true }).click()
    await guestPage.getByRole('button', { name: /update our response/i }).click()
    await expect(guestPage.getByRole('status')).toBeVisible()
    await guestPage.close()

    await page.goto('/dashboard/menu')
    // One salmon, no beef — not one of each.
    await expect(
      tallyRegion(page)
        .getByRole('listitem')
        .filter({ hasText: `${id} salmon` }),
    ).toContainText('1')
    await expect(
      tallyRegion(page)
        .getByRole('listitem')
        .filter({ hasText: `${id} beef` }),
    ).toContainText('0')
  })

  test('declining clears any meal choice, so the caterer does not plate for them', async ({
    page,
    context,
    accounts,
    id,
  }) => {
    await signIn(page, accounts.organiser)
    await createCourse(page, id, [`${id} beef`])
    const invitationUrl = await createInvitedGuest(page, id)

    const guestPage = await context.browser()!.newPage()
    await guestPage.goto(invitationUrl)
    await guestPage
      .getByRole('group', { name: `Eater ${id}` })
      .getByText('Joyfully accepts')
      .click()
    await guestPage.getByText(`${id} beef`, { exact: true }).click()
    await guestPage.getByRole('button', { name: /send our response/i }).click()
    await expect(guestPage.getByRole('status')).toBeVisible()

    await guestPage.goto(invitationUrl)
    await guestPage
      .getByRole('group', { name: `Eater ${id}` })
      .getByText('Regretfully declines')
      .click()
    await guestPage.getByRole('button', { name: /update our response/i }).click()
    await expect(guestPage.getByRole('status')).toBeVisible()
    await guestPage.close()

    await page.goto('/dashboard/menu')
    await expect(
      tallyRegion(page)
        .getByRole('listitem')
        .filter({ hasText: `${id} beef` }),
    ).toContainText('0')
  })

  test('an adult is not offered the children’s menu', async ({ page, context, accounts, id }) => {
    await signIn(page, accounts.organiser)
    await createCourse(page, `${id} kids`, [`${id} nuggets`], true)
    const invitationUrl = await createInvitedGuest(page, id)

    const guestPage = await context.browser()!.newPage()
    await guestPage.goto(invitationUrl)
    await guestPage
      .getByRole('group', { name: `Eater ${id}` })
      .getByText('Joyfully accepts')
      .click()

    // The adult guest never sees it.
    await expect(guestPage.getByText(`${id} nuggets`)).toHaveCount(0)
    await guestPage.close()
  })

  test('a child is offered the children’s menu', async ({ page, context, accounts, id }) => {
    await signIn(page, accounts.organiser)
    await createCourse(page, `${id} kids`, [`${id} nuggets`], true)
    const invitationUrl = await createInvitedGuest(page, id, 'child')

    const guestPage = await context.browser()!.newPage()
    await guestPage.goto(invitationUrl)
    await guestPage
      .getByRole('group', { name: `Eater ${id}` })
      .getByText('Joyfully accepts')
      .click()

    await expect(guestPage.getByText(`${id} nuggets`, { exact: true })).toBeVisible()
    await guestPage.close()
  })
})

test.describe('meal choice tampering', () => {
  test('an option posted against the wrong course is rejected', async ({
    page,
    request,
    accounts,
    id,
  }) => {
    await signIn(page, accounts.organiser)
    await createCourse(page, `${id} a`, [`${id} one`])
    await createCourse(page, `${id} b`, [`${id} two`])

    const invitationUrl = await createInvitedGuest(page, id)
    const token = invitationUrl.split('/invite/')[1]

    // The guest's real id, via the organiser API — the test needs a *valid* guest so the
    // meal check is reached rather than the party-ownership check firing first.
    const lookup = await page.request.get(`/api/guests?where[lastName][equals]=${id}&limit=1`)
    const guestId = (await lookup.json()).docs[0].id as number

    const response = await request.post('/api/rsvp', {
      data: {
        token,
        guests: [
          {
            guestId,
            rsvpStatus: 'attending',
            // Course and option ids that do not belong together.
            mealSelections: [{ courseId: 999_999, optionId: 999_998 }],
          },
        ],
      },
    })

    expect(response.status()).toBe(400)
    expect(await response.text()).toMatch(/not available/i)
  })

  test('the caterer export is not reachable anonymously', async ({ browser }) => {
    // Contains names, allergies, and dietary requirements — special-category data.
    const anonymous = await browser.newContext()
    const response = await anonymous.request.get('/api/menu/export', {
      maxRedirects: 0,
      failOnStatusCode: false,
    })
    expect(response.status()).toBeGreaterThanOrEqual(300)
    expect(await response.text()).not.toContain('allergies')
    await anonymous.close()
  })

  test('the caterer export lists guests with their choices', async ({ page, accounts }) => {
    await signIn(page, accounts.organiser)

    const response = await page.request.get('/api/menu/export')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/csv')
    expect(response.headers()['content-disposition']).toContain('attachment')

    const csv = await response.text()
    expect(csv).toContain('name,party,ageGroup')
    expect(csv).toContain('allergies')
  })
})
