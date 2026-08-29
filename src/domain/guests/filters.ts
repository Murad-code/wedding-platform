import { isRsvpStatus, type RsvpStatus } from '@/domain/rsvp/status'
import { isAgeGroup, type AgeGroup } from './guest'

/**
 * Guest-list filtering, expressed as a plain object so it can round-trip through the URL.
 *
 * Filter state lives in the URL (docs/UX.md §3.2) so a filtered view survives a refresh
 * and can be shared — "the twelve people who still haven't chosen a meal" is a link an
 * organiser wants to send their partner, not a state they want to rebuild.
 */

export const GUEST_SORTS = ['name', 'party', 'status', 'recent'] as const
export type GuestSort = (typeof GUEST_SORTS)[number]

export const SPECIAL_FILTERS = ['dietary', 'unassigned', 'plusOne'] as const
export type SpecialFilter = (typeof SPECIAL_FILTERS)[number]

export const PAGE_SIZE = 50

export type GuestFilters = {
  search: string | null
  rsvpStatus: RsvpStatus | null
  ageGroup: AgeGroup | null
  partyId: number | null
  tagId: number | null
  special: SpecialFilter | null
  sort: GuestSort
  page: number
}

export const DEFAULT_FILTERS: GuestFilters = {
  search: null,
  rsvpStatus: null,
  ageGroup: null,
  partyId: null,
  tagId: null,
  special: null,
  sort: 'name',
  page: 1,
}

function single(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function positiveInt(value: string | null): number | null {
  if (!value) return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

/**
 * Reads filters from URL search params.
 *
 * Anything unrecognised falls back to the default rather than throwing: a hand-edited or
 * stale URL should show an unfiltered list, not an error page.
 */
export function parseGuestFilters(
  params: Record<string, string | string[] | undefined>,
): GuestFilters {
  const search = single(params.q)?.trim() ?? null
  const status = single(params.status)
  const age = single(params.age)
  const special = single(params.special)
  const sort = single(params.sort)

  return {
    search: search && search.length > 0 ? search.slice(0, 100) : null,
    rsvpStatus: isRsvpStatus(status) ? status : null,
    ageGroup: isAgeGroup(age) ? age : null,
    partyId: positiveInt(single(params.party)),
    tagId: positiveInt(single(params.tag)),
    special: (SPECIAL_FILTERS as readonly string[]).includes(special ?? '')
      ? (special as SpecialFilter)
      : null,
    sort: (GUEST_SORTS as readonly string[]).includes(sort ?? '') ? (sort as GuestSort) : 'name',
    page: positiveInt(single(params.page)) ?? 1,
  }
}

/** Serialises filters back to a query string, omitting defaults to keep URLs readable. */
export function filtersToQuery(filters: GuestFilters): string {
  const params = new URLSearchParams()

  if (filters.search) params.set('q', filters.search)
  if (filters.rsvpStatus) params.set('status', filters.rsvpStatus)
  if (filters.ageGroup) params.set('age', filters.ageGroup)
  if (filters.partyId) params.set('party', String(filters.partyId))
  if (filters.tagId) params.set('tag', String(filters.tagId))
  if (filters.special) params.set('special', filters.special)
  if (filters.sort !== 'name') params.set('sort', filters.sort)
  if (filters.page > 1) params.set('page', String(filters.page))

  return params.toString()
}

/** True when the organiser has narrowed the list at all. */
export function hasActiveFilters(filters: GuestFilters): boolean {
  return Boolean(
    filters.search ||
    filters.rsvpStatus ||
    filters.ageGroup ||
    filters.partyId ||
    filters.tagId ||
    filters.special,
  )
}

/** Changing a filter returns to page 1 — page 7 of a new filter is rarely meaningful. */
export function withFilter<K extends keyof GuestFilters>(
  filters: GuestFilters,
  key: K,
  value: GuestFilters[K],
): GuestFilters {
  const next = { ...filters, [key]: value }
  if (key !== 'page') next.page = 1
  return next
}

/**
 * Sort keys, as arrays because that is Payload's multi-key form.
 *
 * Name sorts surname then forename, so members of one family read in a stable order
 * rather than an arbitrary one.
 */
export const SORT_ORDERS: Record<GuestSort, string[]> = {
  name: ['lastName', 'firstName'],
  party: ['party', 'lastName', 'firstName'],
  status: ['rsvpStatus', 'lastName'],
  recent: ['-createdAt'],
}

/**
 * Builds the Payload query for a filter set.
 *
 * Returns a plain object rather than importing Payload's `Where` type, keeping the domain
 * free of framework types; the data layer casts it at the boundary.
 */
export function guestFiltersToWhere(filters: GuestFilters): Record<string, unknown> {
  const and: Record<string, unknown>[] = []

  if (filters.search) {
    and.push({
      or: [
        { firstName: { like: filters.search } },
        { lastName: { like: filters.search } },
        { email: { like: filters.search } },
      ],
    })
  }

  if (filters.rsvpStatus) and.push({ rsvpStatus: { equals: filters.rsvpStatus } })
  if (filters.ageGroup) and.push({ ageGroup: { equals: filters.ageGroup } })
  if (filters.partyId) and.push({ party: { equals: filters.partyId } })
  if (filters.tagId) and.push({ tags: { in: [filters.tagId] } })

  if (filters.special === 'dietary') {
    // "Needs attention from the caterer" — either field qualifies.
    and.push({
      or: [{ dietaryRequirements: { exists: true } }, { allergies: { exists: true } }],
    })
  }

  if (filters.special === 'plusOne') and.push({ isPlusOne: { equals: true } })

  // Seating lands in Phase 6; until then "unassigned" would match every guest, which
  // would be misleading rather than merely empty.
  if (filters.special === 'unassigned') and.push({ id: { exists: true } })

  return and.length > 0 ? { and } : {}
}
