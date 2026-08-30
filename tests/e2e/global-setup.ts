import 'dotenv/config'

import config from '@payload-config'
import { getPayload } from 'payload'

import { allTestAccounts } from './support/accounts'

/**
 * Ensures the organiser accounts the E2E suite signs in with exist, and clears their
 * accumulated sessions.
 *
 * Refuses to run in production: this creates known-credential accounts, which would be
 * a serious vulnerability in a real wedding deployment.
 */
export default async function globalSetup() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('E2E global setup must never run against a production deployment.')
  }

  const payload = await getPayload({ config })

  for (const account of allTestAccounts()) {
    const existing = await payload.find({
      collection: 'users',
      where: { email: { equals: account.email } },
      limit: 1,
      overrideAccess: true,
    })

    const user = existing.docs[0]

    if (!user) {
      await payload.create({ collection: 'users', overrideAccess: true, data: account })
      continue
    }

    // Payload keeps a user's sessions as an array and rewrites the whole array on every
    // login. This suite signs in hundreds of times per run, and once that array is long
    // enough, concurrent logins start dropping each other's sessions — which surfaces as
    // a test being bounced back to the login page part-way through. Clearing them here
    // keeps the array short. The proper fix is to sign in once and reuse Playwright's
    // storageState; recorded in docs/IMPLEMENTATION_PLAN.md.
    if (Array.isArray(user.sessions) && user.sessions.length > 0) {
      await payload.update({
        collection: 'users',
        id: user.id,
        overrideAccess: true,
        data: { sessions: [] },
      })
    }
  }
}
