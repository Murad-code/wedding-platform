import type { RsvpStatus } from '@/domain/rsvp/status'

export const AGE_GROUPS = ['adult', 'child', 'infant'] as const
export type AgeGroup = (typeof AGE_GROUPS)[number]

export function isAgeGroup(value: unknown): value is AgeGroup {
  return typeof value === 'string' && (AGE_GROUPS as readonly string[]).includes(value)
}

/** A guest as the guest-facing invitation page sees them. Deliberately minimal. */
export type InvitationGuest = {
  id: number
  firstName: string
  lastName: string | null
  displayName: string
  ageGroup: AgeGroup
  rsvpStatus: RsvpStatus
  isPlusOne: boolean
  dietaryRequirements: string | null
  allergies: string | null
  accessibilityNeeds: string | null
}

export function guestDisplayName(firstName: string, lastName: string | null): string {
  return lastName ? `${firstName} ${lastName}` : firstName
}

/** Children may be offered a separate menu; infants are not catered for by course. */
export function isChildMenuEligible(ageGroup: AgeGroup): boolean {
  return ageGroup === 'child'
}

/** Infants are counted separately from adults and children for catering. */
export function countsTowardCatering(ageGroup: AgeGroup): boolean {
  return ageGroup !== 'infant'
}
