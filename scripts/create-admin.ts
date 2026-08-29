import 'dotenv/config'

import config from '@payload-config'
import { getPayload } from 'payload'

/**
 * Bootstraps the first organiser account for a deployment
 * (docs/CLIENT_DEPLOYMENT.md §8).
 *
 * Credentials come from the environment so a password never lands in shell history,
 * a process listing, or this repository.
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='…' ADMIN_NAME='Your Name' pnpm create-admin
 */
async function main() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  const name = process.env.ADMIN_NAME ?? 'Administrator'

  if (!email || !password) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD are required.')
    process.exit(1)
  }

  if (password.length < 12) {
    console.error('ADMIN_PASSWORD must be at least 12 characters.')
    process.exit(1)
  }

  const payload = await getPayload({ config })

  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  })

  if (existing.totalDocs > 0) {
    console.error(`An account already exists for ${email}. No changes made.`)
    process.exit(1)
  }

  await payload.create({
    collection: 'users',
    overrideAccess: true,
    data: { email, password, name, role: 'admin' },
  })

  // Never log the password.
  console.log(`Created admin account for ${email}.`)
  process.exit(0)
}

main().catch((error) => {
  console.error('Failed to create admin account:', error instanceof Error ? error.message : error)
  process.exit(1)
})
