import { z } from 'zod'

import { RSVP_STATUSES } from './status'

/**
 * RSVP submission shape, shared by the browser form and the server handler.
 *
 * The client uses this for immediate feedback; the **server re-validates with the same
 * schema and that result is authoritative** (docs/SECURITY.md §6). A guest can post
 * whatever they like to the endpoint, so nothing here may be assumed.
 */

/** Free text is length-capped to bound storage, log volume, and abuse. */
const freeText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .optional()

export const guestResponseSchema = z.object({
  guestId: z.number().int().positive(),
  // A guest may only choose to attend or decline — they cannot set themselves back to
  // "pending" to escape the chase list.
  rsvpStatus: z.enum(
    RSVP_STATUSES.filter((status) => status !== 'pending') as [string, ...string[]],
  ),
  dietaryRequirements: freeText(500),
  allergies: freeText(500),
  accessibilityNeeds: freeText(500),
})

export const rsvpSubmissionSchema = z.object({
  guests: z.array(guestResponseSchema).min(1, 'At least one guest must respond'),
  messageToCouple: freeText(2000),
  contactEmail: z
    .union([z.string().trim().email(), z.literal('')])
    .nullable()
    .optional(),
  contactPhone: freeText(40),
})

export type GuestResponseInput = z.infer<typeof guestResponseSchema>
export type RsvpSubmissionInput = z.infer<typeof rsvpSubmissionSchema>

/**
 * Confirms every submitted guest actually belongs to the resolved party.
 *
 * Without this, a guest could take their own valid token and post another party's guest
 * ids, editing responses that are not theirs — the token proves which party you are, not
 * which guests you may write (docs/SECURITY.md T4).
 */
export function guestsBelongToParty(
  submitted: readonly { guestId: number }[],
  partyGuestIds: readonly number[],
): boolean {
  const allowed = new Set(partyGuestIds)
  return submitted.every((response) => allowed.has(response.guestId))
}
