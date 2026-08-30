// @vitest-environment node
import { randomUUID } from 'node:crypto'

import config from '@payload-config'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { ResolvedParty } from '@/lib/invitations'
import { submitRsvp } from '@/lib/rsvp'

/**
 * SMS consent is a lawful basis, not a preference (docs/SECURITY.md §7), so the rules
 * around it are checked against the database rather than in the abstract: what matters is
 * what is actually stored on the guest after a submission.
 */

let payload: Payload
let partyId: number
let guestId: number
const scope = `consent-${randomUUID().slice(0, 8)}`

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
      rsvpStatus: 'pending',
      ageGroup: 'adult',
    },
  })
  guestId = guest.id
})

afterAll(async () => {
  await payload
    .delete({ collection: 'invitation-parties', id: partyId, overrideAccess: true })
    .catch(() => undefined)
})

function party(): ResolvedParty {
  return {
    id: partyId,
    displayName: scope,
    plusOnesAllowed: 0,
    messageToCouple: null,
    contactEmail: null,
    contactPhone: null,
    respondedAt: null,
    guests: [
      {
        id: guestId,
        firstName: 'Ada',
        lastName: scope,
        displayName: `Ada ${scope}`,
        ageGroup: 'adult',
        rsvpStatus: 'pending',
        isPlusOne: false,
        dietaryRequirements: null,
        allergies: null,
        accessibilityNeeds: null,
      },
    ],
  }
}

const submission = (smsConsent: boolean) => ({
  guests: [{ guestId, rsvpStatus: 'attending' as const, mealSelections: [] }],
  messageToCouple: null,
  contactEmail: null,
  contactPhone: '+447700900123',
  smsConsent,
})

async function storedGuest() {
  return payload.findByID({ collection: 'guests', id: guestId, depth: 0, overrideAccess: true })
}

describe('SMS consent through the RSVP', () => {
  it('records consent when the wedding sends texts and the guest ticked the box', async () => {
    const result = await submitRsvp({
      party: party(),
      submission: submission(true),
      smsEnabled: true,
    })
    expect(result.ok).toBe(true)

    const guest = await storedGuest()
    expect(guest.smsConsent).toBe(true)
    // Stamped so it can be evidenced later.
    expect(guest.smsConsentAt).toBeTruthy()
  })

  it('withdraws consent when the box is unticked again', async () => {
    await submitRsvp({ party: party(), submission: submission(false), smsEnabled: true })

    const guest = await storedGuest()
    expect(guest.smsConsent).toBe(false)
    // A stale date would suggest permission the guest has since revoked.
    expect(guest.smsConsentAt).toBeNull()
  })

  it('ignores consent posted to a wedding that does not send texts', async () => {
    // The form does not show the box, but the endpoint accepts anything: the server
    // decides, not the client (docs/SECURITY.md §6).
    await submitRsvp({ party: party(), submission: submission(true), smsEnabled: false })

    expect((await storedGuest()).smsConsent).toBe(false)
  })

  it('does not treat a number alone as consent', async () => {
    const withNumberOnly = { ...submission(false), contactPhone: '+447700900999' }
    await submitRsvp({ party: party(), submission: withNumberOnly, smsEnabled: true })

    const guest = await storedGuest()
    expect(guest.smsConsent).toBe(false)

    // The number is still kept on the party — the couple asked for a way to reach them.
    const stored = await payload.findByID({
      collection: 'invitation-parties',
      id: partyId,
      depth: 0,
      overrideAccess: true,
    })
    expect(stored.contactPhone).toBe('+447700900999')
  })
})
