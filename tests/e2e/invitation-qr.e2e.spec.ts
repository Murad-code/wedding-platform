import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'

import type { Page } from '@playwright/test'
import jsQR from 'jsqr'
import sharp from 'sharp'

import { expect, test as base } from './support/fixtures'

const test = base.extend<{ id: string }>({
  id: async ({ page }, use) => {
    const id = `Q${randomUUID().slice(0, 8)}`
    await use(id)
    await page.request
      .delete(`/api/invitation-parties?where[displayName][contains]=${id}`)
      .catch(() => undefined)
  },
})

async function decodeQr(png: Buffer): Promise<string | null> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data ?? null
}

/** Creates a household with one guest and returns its one-time invitation link. */
async function createInvitation(page: Page, partyName: string) {
  await page.goto('/dashboard/parties')
  await page.getByLabel('Party name').fill(partyName)
  await page.getByRole('button', { name: 'Add party' }).click()
  await expect(page.getByRole('heading', { name: partyName })).toBeVisible()

  await page.getByLabel('First name').fill('Card')
  await page.getByLabel('Last name').fill('Holder')
  await page.getByRole('button', { name: 'Add guest' }).click()
  await expect(page.getByText('Card Holder')).toBeVisible()

  await page.getByRole('button', { name: /create invitation link/i }).click()
  return page.getByTestId('invitation-url').innerText()
}

test.describe('QR codes for printed invitations', () => {
  test('the downloaded code opens that household’s invitation', async ({
    page,
    browser,
    accounts,
    id,
  }) => {
    const partyName = `The ${id} Family`
    await page.goto('/login')
    await page.getByLabel('Email').fill(accounts.organiser.email)
    await page.getByLabel('Password').fill(accounts.organiser.password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/dashboard/)

    const policyRefusals: string[] = []
    page.on('console', (message) => {
      if (/content security policy|refused to/i.test(message.text()))
        policyRefusals.push(message.text())
    })

    const url = await createInvitation(page, partyName)
    const token = url.split('/invite/')[1] ?? ''
    expect(token).toHaveLength(43)

    // The token exists only in this response; making the code must not send it anywhere.
    const outgoing: string[] = []
    page.on('request', (request) => outgoing.push(request.url() + (request.postData() ?? '')))

    await expect(
      page.getByRole('img', { name: `QR code for ${partyName}’s invitation` }),
    ).toBeVisible()

    const [png] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: `Download PNG QR code for ${partyName}` }).click(),
    ])
    expect(png.suggestedFilename()).toBe(`invitation-the-${id.toLowerCase()}-family.png`)
    expect(await decodeQr(await readFile((await png.path()) ?? ''))).toBe(url)

    const [svg] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: `Download SVG QR code for ${partyName}` }).click(),
    ])
    expect(svg.suggestedFilename()).toMatch(/\.svg$/)
    expect(await readFile((await svg.path()) ?? '', 'utf8')).toContain('<svg')

    expect(outgoing.filter((entry) => entry.includes(token))).toEqual([])
    expect(policyRefusals).toEqual([])

    // A guest scanning the card lands on their own invitation, with no organiser session.
    const guest = await browser.newContext()
    const guestPage = await guest.newPage()
    await guestPage.goto(url)
    await expect(guestPage.getByRole('heading', { name: /you’re invited/i })).toBeVisible()
    await expect(guestPage.getByText(partyName)).toBeVisible()
    await guest.close()
  })

  test('replacing a link warns that printed codes stop working', async ({ page, accounts, id }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(accounts.organiser.email)
    await page.getByLabel('Password').fill(accounts.organiser.password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/dashboard/)

    await createInvitation(page, `The ${id} Family`)
    await expect(page.getByText(/including any QR code already printed/i)).toBeVisible()
  })
})
