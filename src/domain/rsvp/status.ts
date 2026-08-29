/**
 * RSVP state.
 *
 * `Guest.rsvpStatus` is the single source of current truth (ADR-009). A party's status is
 * derived from its guests rather than stored independently, so the two can never
 * disagree — the classic bug when household and individual state are both writable.
 */

export const RSVP_STATUSES = ['pending', 'attending', 'declined'] as const
export type RsvpStatus = (typeof RSVP_STATUSES)[number]

export const PARTY_STATUSES = ['pending', 'partial', 'complete'] as const
export type PartyStatus = (typeof PARTY_STATUSES)[number]

export function isRsvpStatus(value: unknown): value is RsvpStatus {
  return typeof value === 'string' && (RSVP_STATUSES as readonly string[]).includes(value)
}

/**
 * Derives a party's status from its guests.
 *
 * - `pending`  — nobody has answered yet
 * - `partial`  — some have answered, some have not
 * - `complete` — everyone has answered, whatever they said
 *
 * Note that a party where everyone declined is `complete`, not `pending`: they have
 * responded, and the chase list must not keep nagging them.
 */
export function derivePartyStatus(guestStatuses: readonly RsvpStatus[]): PartyStatus {
  if (guestStatuses.length === 0) return 'pending'

  const responded = guestStatuses.filter((status) => status !== 'pending').length

  if (responded === 0) return 'pending'
  if (responded === guestStatuses.length) return 'complete'
  return 'partial'
}

export type RsvpTotals = {
  invited: number
  attending: number
  declined: number
  pending: number
}

/** Headline counts for the organiser dashboard. */
export function tallyRsvps(guestStatuses: readonly RsvpStatus[]): RsvpTotals {
  return guestStatuses.reduce<RsvpTotals>(
    (totals, status) => {
      totals.invited += 1
      totals[status] += 1
      return totals
    },
    { invited: 0, attending: 0, declined: 0, pending: 0 },
  )
}
