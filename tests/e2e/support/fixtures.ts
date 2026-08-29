import { test as base } from '@playwright/test'

import { accountsForWorker, type WorkerAccounts } from './accounts'

/**
 * Provides each worker its own organiser accounts, so parallel tests never contend for
 * the same Payload session (see accounts.ts).
 */
export const test = base.extend<{ accounts: WorkerAccounts }>({
  accounts: async ({}, use, testInfo) => {
    await use(accountsForWorker(testInfo.parallelIndex))
  },
})

export { expect } from '@playwright/test'
