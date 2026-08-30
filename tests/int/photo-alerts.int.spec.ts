// @vitest-environment node
import { randomUUID } from 'node:crypto'

import config from '@payload-config'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runQueueAction } from '@/lib/photo-queue'

let payload: Payload
let partyId: number
let guestId: number
let firstGroupId: number
const scope = `alerts-${randomUUID().slice(0, 8)}`

beforeAll(async () => {
  payload = await getPayload({ config })

  await payload.delete({
    collection: 'photo-groups',
    where: { id: { greater_than: 0 } },
    overrideAccess: true,
  })

  const party = await payload.create({
    collection: 'invitation-parties',
    overrideAccess: true,
    data: { displayName: scope, status: 'pending' },
  })
  partyId = party.id

  const guest = await payload.create({
    collection: 'guests',
    overrideAccess: true,
    data: {
      firstName: 'Ada',
      lastName: scope,
      party: partyId,
      rsvpStatus: 'attending',
      ageGroup: 'adult',
      email: `${scope}@example.test`,
    },
  })
  guestId = guest.id

  const first = await payload.create({
    collection: 'photo-groups',
    overrideAccess: true,
    data: { name: `${scope} first`, order: 0, status: 'queued', members: [guestId] },
  })
  firstGroupId = first.id

  await payload.create({
    collection: 'photo-groups',
    overrideAccess: true,
    data: { name: `${scope} second`, order: 1, status: 'queued', members: [] },
  })
})

afterAll(async () => {
  await payload
    .delete({ collection: 'invitation-parties', id: partyId, overrideAccess: true })
    .catch(() => undefined)
  await payload
    .delete({
      collection: 'photo-groups',
      where: { name: { contains: scope } },
      overrideAccess: true,
    })
    .catch(() => undefined)
})

describe('alerts on a queue action', () => {
  it('messages each member of the group being called, once', async () => {
    const result = await runQueueAction('call-next')

    expect(result.ok).toBe(true)
    expect(result.ok && result.alerts).toEqual({ queued: 1, duplicate: 0, unreachable: 0 })
  })

  it('steps back to a group that has already been messaged without hanging', async () => {
    // Previous re-calls a group whose members were told about it already, so the alert
    // path has to survive its own deduplication.
    await runQueueAction('call-next')
    const back = await runQueueAction('previous')

    expect(back.ok).toBe(true)
    expect(back.ok && back.alerts).toEqual({ queued: 0, duplicate: 1, unreachable: 0 })
  })

  it('wrote exactly one row', async () => {
    const rows = await payload.find({
      collection: 'notifications',
      where: { guest: { equals: guestId } },
      limit: 20,
      overrideAccess: true,
    })

    expect(rows.totalDocs).toBe(1)
    expect(rows.docs[0]?.dedupeKey).toBe(`photo.now:${firstGroupId}:${guestId}`)
  })
})
