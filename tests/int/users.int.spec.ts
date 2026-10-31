// @vitest-environment node
import { randomUUID } from 'node:crypto'

import config from '@payload-config'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { User } from '@/payload-types'

// The dashboard checks these rules too; this proves the collection enforces them for
// every route in, including Payload admin and the REST API.

let payload: Payload
let admin: User
let organiser: User
const scope = `int-${randomUUID().slice(0, 8)}`

beforeAll(async () => {
  payload = await getPayload({ config })

  const make = (role: User['role']) =>
    payload.create({
      collection: 'users',
      overrideAccess: true,
      data: {
        email: `${scope}-${role}@example.test`,
        password: `${scope}-password`,
        name: `${scope} ${role}`,
        role,
      },
    })

  admin = await make('admin')
  organiser = await make('organiser')
})

afterAll(async () => {
  await payload
    .delete({
      collection: 'users',
      where: { email: { contains: scope } },
      overrideAccess: true,
    })
    .catch(() => undefined)
})

describe('team rules on the users collection', () => {
  it('refuses an admin changing their own role', async () => {
    await expect(
      payload.update({
        collection: 'users',
        id: admin.id,
        data: { role: 'viewer' },
        user: admin,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/own role/)
  })

  it('refuses an admin deleting their own account', async () => {
    await expect(
      payload.delete({ collection: 'users', id: admin.id, user: admin, overrideAccess: false }),
    ).rejects.toThrow(/your own account/)
  })

  it('lets an admin change someone else’s role', async () => {
    const updated = await payload.update({
      collection: 'users',
      id: organiser.id,
      data: { role: 'viewer' },
      user: admin,
      overrideAccess: false,
    })
    expect(updated.role).toBe('viewer')
  })

  it('leaves logins alone, which rewrite the user without touching the role', async () => {
    const result = await payload.login({
      collection: 'users',
      data: { email: admin.email, password: `${scope}-password` },
    })
    expect(result.user?.id).toBe(admin.id)
  })
})
