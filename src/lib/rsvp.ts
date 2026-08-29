import config from '@payload-config'
import { getPayload } from 'payload'

import { guestsBelongToParty, type RsvpSubmissionInput } from '@/domain/rsvp/schema'
import { validateSelections, type MenuCourse } from '@/domain/menu/menu'
import { derivePartyStatus, isRsvpStatus, type RsvpStatus } from '@/domain/rsvp/status'
import { replaceSelections } from '@/lib/menu'
import { recordAuditEvent } from '@/lib/audit'
import type { ResolvedParty } from '@/lib/invitations'

export type RsvpResult =
  { ok: true } | { ok: false; reason: 'closed' | 'foreign-guest' | 'invalid-meal' | 'failed' }

/**
 * Persists a party's RSVP.
 *
 * Runs inside a single transaction: a household's responses, the derived party status,
 * and the response timestamp must all land together. A partial write would leave the
 * dashboard showing a household as half-answered when it never was.
 */
export async function submitRsvp({
  party,
  submission,
  menu = [],
  ip,
}: {
  party: ResolvedParty
  submission: RsvpSubmissionInput
  /** Empty when the menu feature is off, in which case choices are ignored. */
  menu?: readonly MenuCourse[]
  ip?: string | null
}): Promise<RsvpResult> {
  const partyGuestIds = party.guests.map((guest) => guest.id)

  // The token proves which party you are, not which guests you may write.
  if (!guestsBelongToParty(submission.guests, partyGuestIds)) {
    return { ok: false, reason: 'foreign-guest' }
  }

  // Meal choices are checked against the real menu: a guest can post any ids they like,
  // so "this option belongs to this course" and "this course is offered to this guest"
  // cannot be inferred from the form.
  if (menu.length > 0) {
    for (const response of submission.guests) {
      const guest = party.guests.find((candidate) => candidate.id === response.guestId)
      if (!guest) continue
      // Only attending guests eat; choices from a declining guest are simply dropped.
      if (response.rsvpStatus !== 'attending') continue

      const problems = validateSelections({
        courses: menu,
        ageGroup: guest.ageGroup,
        selections: response.mealSelections ?? [],
      })
      if (problems.length > 0) return { ok: false, reason: 'invalid-meal' }
    }
  }

  const payload = await getPayload({ config })
  const transactionID = await payload.db.beginTransaction()

  if (!transactionID) {
    return { ok: false, reason: 'failed' }
  }

  const req = { transactionID } as Parameters<typeof payload.update>[0]['req']

  try {
    const respondedAt = new Date().toISOString()
    const submitted = new Map<number, RsvpStatus>()

    for (const response of submission.guests) {
      if (!isRsvpStatus(response.rsvpStatus)) continue
      submitted.set(response.guestId, response.rsvpStatus)

      await payload.update({
        collection: 'guests',
        id: response.guestId,
        overrideAccess: true,
        req,
        data: {
          rsvpStatus: response.rsvpStatus,
          dietaryRequirements: response.dietaryRequirements ?? null,
          allergies: response.allergies ?? null,
          accessibilityNeeds: response.accessibilityNeeds ?? null,
          respondedAt,
        },
      })

      if (menu.length > 0) {
        // A guest who switches to "declined" has their choices cleared, so the caterer
        // never plates for someone who is not coming.
        await replaceSelections(
          response.guestId,
          response.rsvpStatus === 'attending' ? (response.mealSelections ?? []) : [],
          transactionID,
        )
      }
    }

    // Guests not included in this submission keep their existing status, so an edit
    // that touches one person does not silently reset the rest of the household.
    const statuses = party.guests.map((guest) => submitted.get(guest.id) ?? guest.rsvpStatus)

    await payload.update({
      collection: 'invitation-parties',
      id: party.id,
      overrideAccess: true,
      req,
      data: {
        status: derivePartyStatus(statuses),
        messageToCouple: submission.messageToCouple ?? null,
        contactEmail: submission.contactEmail || null,
        contactPhone: submission.contactPhone ?? null,
        respondedAt,
      },
    })

    await payload.db.commitTransaction(transactionID)

    // Audited after commit so a logging failure cannot roll back a guest's response.
    // Records counts only — never names, contact details, or dietary information.
    await recordAuditEvent({
      action: 'rsvp.submitted',
      actorType: 'guest',
      entityType: 'invitation-parties',
      entityId: String(party.id),
      metadata: {
        guestsResponded: submission.guests.length,
        attending: statuses.filter((status) => status === 'attending').length,
        declined: statuses.filter((status) => status === 'declined').length,
      },
      ip,
    })

    return { ok: true }
  } catch (error) {
    await payload.db.rollbackTransaction(transactionID)
    // Never log the submission body — it contains guest PII and health data.
    console.error('RSVP submission failed', {
      partyId: party.id,
      message: error instanceof Error ? error.message : 'unknown error',
    })
    return { ok: false, reason: 'failed' }
  }
}
