import 'dotenv/config'

import config from '@payload-config'
import { getPayload } from 'payload'

import { TEST_ACCOUNTS } from './support/accounts'

/**
 * Ensures the organiser accounts the E2E suite signs in with exist.
 *
 * Refuses to run in production: this creates known-credential accounts, which would be
 * a serious vulnerability in a real wedding deployment.
 */
export default async function globalSetup() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('E2E global setup must never run against a production deployment.')
  }

  const payload = await getPayload({ config })

  for (const account of Object.values(TEST_ACCOUNTS)) {
    const existing = await payload.find({
      collection: 'users',
      where: { email: { equals: account.email } },
      limit: 1,
      overrideAccess: true,
    })

    if (existing.totalDocs === 0) {
      await payload.create({ collection: 'users', overrideAccess: true, data: account })
    }
  }
}
