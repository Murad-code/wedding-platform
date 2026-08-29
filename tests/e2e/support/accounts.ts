import type { Role } from '@/domain/auth/roles'

/**
 * Test organiser accounts, one set per Playwright worker.
 *
 * Two parallel tests signing in as the *same* account race on Payload's session list and
 * one login silently invalidates the other, which shows up as a random redirect back to
 * the login page. Giving each worker its own accounts removes the contention rather than
 * papering over it with retries.
 *
 * These are obviously-placeholder credentials for a local or CI database only; the setup
 * refuses to run against production.
 */
export const WORKER_SLOTS = 8

const PASSWORD = 'e2e-only-password-123'

export type TestAccount = {
  email: string
  password: string
  name: string
  role: Role
}

function account(role: Role, slot: number): TestAccount {
  return {
    email: `e2e-${role}-${slot}@example.test`,
    password: PASSWORD,
    name: `E2E ${role} ${slot}`,
    role,
  }
}

export type WorkerAccounts = {
  admin: TestAccount
  organiser: TestAccount
  viewer: TestAccount
}

export function accountsForWorker(slot: number): WorkerAccounts {
  const index = slot % WORKER_SLOTS
  return {
    admin: account('admin', index),
    organiser: account('organiser', index),
    viewer: account('viewer', index),
  }
}

export function allTestAccounts(): TestAccount[] {
  return Array.from({ length: WORKER_SLOTS }, (_, slot) =>
    Object.values(accountsForWorker(slot)),
  ).flat()
}
