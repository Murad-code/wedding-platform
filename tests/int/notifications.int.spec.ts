// @vitest-environment node
import { randomUUID } from 'node:crypto'

import config from '@payload-config'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { dispatchDue, enqueue, recipientsFor } from '@/lib/notifications/dispatch'

/**
 * Deduplication and delivery against the real database.
 *
 * These cannot be unit tests: the guarantee being verified is a `UNIQUE` index doing its
 * job under concurrency (ADR-023), and an in-memory stand-in would prove nothing about
 * the constraint that actually protects a guest from being texted twice.
 */

let payload: Payload
let partyId: number
let guestId: number
const scope = `int-${randomUUID().slice(0, 8)}`

beforeAll(async () => {
  payload = await getPayload({ config })

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
})

afterAll(async () => {
  // Deleting the party cascades to its guests, whose own hook removes their
  // notifications — so this one call cleans up everything the file created.
  await payload
    .delete({ collection: 'invitation-parties', id: partyId, overrideAccess: true })
    .catch(() => undefined)
})

const input = (subjectId: number) => ({
  type: 'photo.now' as const,
  subjectId,
  recipient: {
    guestId,
    displayName: `Ada ${scope}`,
    email: `${scope}@example.test`,
    phone: null,
    smsConsent: false,
  },
  context: { groupName: 'Kamali family', coupleNames: 'Sarah & Adam' },
  smsEnabled: false,
})

async function notificationsForGuest() {
  const result = await payload.find({
    collection: 'notifications',
    where: { guest: { equals: guestId } },
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs
}

describe('deduplication', () => {
  it('queues a message the first time', async () => {
    expect(await enqueue(input(9001))).toEqual({ queued: true })
  })

  it('refuses the same message a second time', async () => {
    // An organiser stepping back and re-calling a group must not re-text everyone.
    expect(await enqueue(input(9001))).toEqual({ queued: false, reason: 'duplicate' })
  })

  it('writes exactly one row for two callers racing on the same key', async () => {
    // The guarantee is the database's, not the application's: an "is there one already?"
    // check would let both callers through.
    const results = await Promise.all([
      enqueue(input(9002)),
      enqueue(input(9002)),
      enqueue(input(9002)),
    ])

    expect(results.filter((result) => result.queued)).toHaveLength(1)

    const rows = await payload.find({
      collection: 'notifications',
      where: { dedupeKey: { equals: `photo.now:9002:${guestId}` } },
      limit: 10,
      overrideAccess: true,
    })
    expect(rows.totalDocs).toBe(1)
  })

  it('treats a different photograph as a different message', async () => {
    expect(await enqueue(input(9003))).toEqual({ queued: true })
  })
})

describe('eligibility', () => {
  it('does not queue anything for a guest with no way to be reached', async () => {
    const unreachable = { ...input(9004), recipient: { ...input(9004).recipient, email: null } }
    expect(await enqueue(unreachable)).toEqual({ queued: false, reason: 'no-contact-details' })
  })

  it('leaves no row behind, so adding an address later still works', async () => {
    // A failed row would consume the dedupe key and silently swallow the retry.
    const rows = await payload.find({
      collection: 'notifications',
      where: { dedupeKey: { equals: `photo.now:9004:${guestId}` } },
      limit: 1,
      overrideAccess: true,
    })
    expect(rows.totalDocs).toBe(0)
  })

  it('refuses SMS for a guest who has a number but has not consented', async () => {
    const smsOnly = {
      ...input(9005),
      smsEnabled: true,
      recipient: {
        ...input(9005).recipient,
        email: null,
        phone: '+447700900123',
        smsConsent: false,
      },
    }
    expect(await enqueue(smsOnly)).toEqual({ queued: false, reason: 'sms-not-consented' })
  })
})

describe('dispatch', () => {
  it('sends what is due and records the outcome', async () => {
    const summary = await dispatchDue()
    expect(summary.attempted).toBeGreaterThan(0)

    const rows = await notificationsForGuest()
    const sent = rows.filter((row) => row.status === 'sent')

    expect(sent.length).toBeGreaterThan(0)
    // The console provider is used because no real one is configured — no network, no
    // cost, nobody texted.
    expect(sent[0]?.provider).toBe('console')
    expect(sent[0]?.attempts).toBe(1)
  })

  it('leaves nothing due once it has run', async () => {
    expect((await dispatchDue()).attempted).toBe(0)
  })

  it('stores the rendered message so the dispatcher never has to rebuild it', async () => {
    const rows = await notificationsForGuest()
    expect(rows[0]?.body).toContain('Kamali family')
  })
})

describe('recipients', () => {
  it('falls back to the party’s contact details, which is usually all there is', async () => {
    await payload.update({
      collection: 'guests',
      id: guestId,
      overrideAccess: true,
      data: { email: null },
    })
    await payload.update({
      collection: 'invitation-parties',
      id: partyId,
      overrideAccess: true,
      data: { contactEmail: `party-${scope}@example.test`, contactPhone: '+447700900999' },
    })

    const [recipient] = await recipientsFor([guestId])
    expect(recipient?.email).toBe(`party-${scope}@example.test`)
    expect(recipient?.phone).toBe('+447700900999')
  })

  it('never inherits consent from the party', async () => {
    // A household contact number does not make everyone in it textable.
    const [recipient] = await recipientsFor([guestId])
    expect(recipient?.smsConsent).toBe(false)
  })
})

describe('erasure', () => {
  it('deletes a guest’s messages with the guest', async () => {
    // The rendered message contains their name, so erasing the guest must erase it.
    const before = await notificationsForGuest()
    expect(before.length).toBeGreaterThan(0)

    await payload.delete({ collection: 'guests', id: guestId, overrideAccess: true })

    expect(await notificationsForGuest()).toHaveLength(0)
  })
})
