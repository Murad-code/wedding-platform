import config from '@payload-config'
import { getPayload } from 'payload'

import { guestDisplayName, isAgeGroup, type InvitationGuest } from '@/domain/guests/guest'
import {
  generateInvitationToken,
  hashInvitationToken,
  isPlausibleToken,
} from '@/domain/invitations/token'
import { isRsvpStatus } from '@/domain/rsvp/status'
import type { Guest } from '@/payload-types'

export type ResolvedParty = {
  id: number
  displayName: string
  plusOnesAllowed: number
  messageToCouple: string | null
  contactEmail: string | null
  contactPhone: string | null
  respondedAt: string | null
  guests: InvitationGuest[]
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

/**
 * Resolves an invitation token to its party and that party's guests.
 *
 * Returns null for every failure mode — unknown token, malformed token, rotated token —
 * so a caller cannot distinguish "never existed" from "revoked" and turn the endpoint
 * into an oracle (docs/SECURITY.md §2).
 *
 * The party is derived here from the token alone. Callers must never accept a party id
 * from the request.
 */
export async function findPartyByToken(token: unknown): Promise<ResolvedParty | null> {
  // Cheap shape check keeps obvious scanning traffic off the database.
  if (!isPlausibleToken(token)) return null

  const payload = await getPayload({ config })

  const parties = await payload.find({
    collection: 'invitation-parties',
    where: { tokenHash: { equals: hashInvitationToken(token) } },
    limit: 1,
    depth: 0,
    // The collection is closed to anonymous reads by design; this server-side path is
    // the only way a guest reaches their own party.
    overrideAccess: true,
  })

  const party = parties.docs[0]
  if (!party) return null

  const guests = await payload.find({
    collection: 'guests',
    where: { party: { equals: party.id } },
    limit: 100,
    depth: 0,
    sort: 'id',
    overrideAccess: true,
  })

  return {
    id: party.id,
    displayName: party.displayName,
    plusOnesAllowed: party.plusOnesAllowed ?? 0,
    messageToCouple: text(party.messageToCouple),
    contactEmail: text(party.contactEmail),
    contactPhone: text(party.contactPhone),
    respondedAt: text(party.respondedAt),
    guests: guests.docs.map(toInvitationGuest),
  }
}

function toInvitationGuest(doc: Guest): InvitationGuest {
  const firstName = doc.firstName
  const lastName = text(doc.lastName)

  return {
    id: doc.id,
    firstName,
    lastName,
    displayName: guestDisplayName(firstName, lastName),
    ageGroup: isAgeGroup(doc.ageGroup) ? doc.ageGroup : 'adult',
    rsvpStatus: isRsvpStatus(doc.rsvpStatus) ? doc.rsvpStatus : 'pending',
    isPlusOne: doc.isPlusOne === true,
    dietaryRequirements: text(doc.dietaryRequirements),
    allergies: text(doc.allergies),
    accessibilityNeeds: text(doc.accessibilityNeeds),
  }
}

/**
 * Issues a fresh invitation token for a party.
 *
 * The raw token is returned **once** and never stored. If an organiser loses it, the
 * only recourse is to issue a new one — which is the correct trade-off for a credential.
 */
export async function issueInvitationToken(partyId: number): Promise<string> {
  const payload = await getPayload({ config })
  const token = generateInvitationToken()

  const existing = await payload.findByID({
    collection: 'invitation-parties',
    id: partyId,
    depth: 0,
    overrideAccess: true,
  })

  await payload.update({
    collection: 'invitation-parties',
    id: partyId,
    overrideAccess: true,
    data: {
      tokenHash: hashInvitationToken(token),
      tokenVersion: (existing.tokenVersion ?? 0) + 1,
    },
  })

  return token
}
