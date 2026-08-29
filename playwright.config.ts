import { defineConfig, devices } from '@playwright/test'
import 'dotenv/config'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // The guest experience is iPhone-first (docs/UX.md §6), so it is tested on WebKit —
    // the engine guests will actually use. CI installs chromium + webkit.
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    // Tests run against a production build, not `next dev`. Compile-on-demand in dev
    // makes the first hit to each route slow enough to time out when projects run in
    // parallel, and the production artifact is what actually ships.
    // Point PLAYWRIGHT_BASE_URL at a running dev server to iterate faster.
    command: 'pnpm build && pnpm start',
    reuseExistingServer: !process.env.CI,
    url: baseURL,
    timeout: 240_000,
  },
})
