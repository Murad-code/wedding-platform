import { expect, test } from './support/fixtures'

/**
 * The guest photo screen on the engine guests actually hold.
 *
 * Deliberately read-only and **content-agnostic**: `photo-queue.e2e.spec.ts` owns the
 * queue and empties it between its own tests, so anything asserted here about what is in
 * the queue would depend on which file happened to run first. What this proves is the
 * part most likely to differ between engines — that `EventSource` connects and the page
 * settles into a live state on WebKit as well as Chromium.
 */
test.describe('the live photo screen', () => {
  test('connects to the stream and says so', async ({ page }) => {
    await page.goto('/photos')

    // "Live" only appears once the EventSource has actually opened, so this is the whole
    // real-time path: route, stream, client, and rendering.
    await expect(page.locator('[data-connection="live"]')).toBeVisible()
  })

  test('tells a guest without their invitation how to see their own photograph', async ({
    page,
  }) => {
    await page.goto('/photos')
    await expect(page.getByText(/open the link from your invitation/i)).toBeVisible()
  })
})
