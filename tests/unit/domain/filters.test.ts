import { describe, expect, it } from 'vitest'

import {
  DEFAULT_FILTERS,
  filtersToQuery,
  guestFiltersToWhere,
  hasActiveFilters,
  parseGuestFilters,
  withFilter,
} from '@/domain/guests/filters'

describe('parseGuestFilters', () => {
  it('returns defaults for an empty query', () => {
    expect(parseGuestFilters({})).toEqual(DEFAULT_FILTERS)
  })

  it('reads every supported filter', () => {
    expect(
      parseGuestFilters({
        q: 'kamali',
        status: 'attending',
        age: 'child',
        party: '7',
        tag: '3',
        special: 'dietary',
        sort: 'party',
        page: '2',
      }),
    ).toEqual({
      search: 'kamali',
      rsvpStatus: 'attending',
      ageGroup: 'child',
      partyId: 7,
      tagId: 3,
      special: 'dietary',
      sort: 'party',
      page: 2,
    })
  })

  it('falls back to defaults for unrecognised values rather than throwing', () => {
    // A hand-edited or stale URL should show an unfiltered list, not an error page.
    const filters = parseGuestFilters({
      status: 'maybe',
      age: 'teenager',
      special: 'nonsense',
      sort: 'sideways',
    })
    expect(filters.rsvpStatus).toBeNull()
    expect(filters.ageGroup).toBeNull()
    expect(filters.special).toBeNull()
    expect(filters.sort).toBe('name')
  })

  it('ignores non-positive or non-numeric ids and pages', () => {
    expect(parseGuestFilters({ party: '0' }).partyId).toBeNull()
    expect(parseGuestFilters({ party: '-3' }).partyId).toBeNull()
    expect(parseGuestFilters({ party: 'abc' }).partyId).toBeNull()
    expect(parseGuestFilters({ page: '1.5' }).page).toBe(1)
  })

  it('takes the first value when a param repeats', () => {
    expect(parseGuestFilters({ status: ['attending', 'declined'] }).rsvpStatus).toBe('attending')
  })

  it('trims search and treats blank as absent', () => {
    expect(parseGuestFilters({ q: '  kamali  ' }).search).toBe('kamali')
    expect(parseGuestFilters({ q: '   ' }).search).toBeNull()
  })

  it('caps search length', () => {
    expect(parseGuestFilters({ q: 'x'.repeat(500) }).search).toHaveLength(100)
  })
})

describe('filtersToQuery', () => {
  it('omits defaults so the URL stays readable', () => {
    expect(filtersToQuery(DEFAULT_FILTERS)).toBe('')
  })

  it('round-trips a filter set', () => {
    const filters = parseGuestFilters({
      q: 'kamali',
      status: 'declined',
      special: 'plusOne',
      sort: 'recent',
      page: '3',
    })
    expect(
      parseGuestFilters(Object.fromEntries(new URLSearchParams(filtersToQuery(filters)))),
    ).toEqual(filters)
  })

  it('encodes search terms safely', () => {
    expect(filtersToQuery({ ...DEFAULT_FILTERS, search: 'a&b=c' })).toBe('q=a%26b%3Dc')
  })
})

describe('hasActiveFilters', () => {
  it('is false by default and true once anything narrows the list', () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false)
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, search: 'a' })).toBe(true)
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, special: 'dietary' })).toBe(true)
  })

  it('does not count sorting or paging as filtering', () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, sort: 'recent', page: 4 })).toBe(false)
  })
})

describe('withFilter', () => {
  it('returns to page 1 when a filter changes', () => {
    // Page 7 of a different filter is rarely the page the organiser wanted.
    const filters = { ...DEFAULT_FILTERS, page: 7 }
    expect(withFilter(filters, 'rsvpStatus', 'attending').page).toBe(1)
  })

  it('keeps the page when paging', () => {
    expect(withFilter({ ...DEFAULT_FILTERS, search: 'a' }, 'page', 3)).toMatchObject({
      page: 3,
      search: 'a',
    })
  })

  it('does not mutate the input', () => {
    const filters = { ...DEFAULT_FILTERS }
    withFilter(filters, 'rsvpStatus', 'declined')
    expect(filters.rsvpStatus).toBeNull()
  })
})

describe('guestFiltersToWhere', () => {
  it('is an empty query when nothing is filtered', () => {
    expect(guestFiltersToWhere(DEFAULT_FILTERS)).toEqual({})
  })

  it('searches across name and email', () => {
    const where = guestFiltersToWhere({ ...DEFAULT_FILTERS, search: 'kam' })
    expect(JSON.stringify(where)).toContain('firstName')
    expect(JSON.stringify(where)).toContain('email')
  })

  it('combines filters with AND', () => {
    const where = guestFiltersToWhere({
      ...DEFAULT_FILTERS,
      rsvpStatus: 'attending',
      ageGroup: 'child',
    })
    expect(where.and).toHaveLength(2)
  })

  it('treats dietary as either requirements or allergies', () => {
    const where = guestFiltersToWhere({ ...DEFAULT_FILTERS, special: 'dietary' })
    expect(JSON.stringify(where)).toContain('dietaryRequirements')
    expect(JSON.stringify(where)).toContain('allergies')
  })

  it('filters plus-ones', () => {
    expect(
      JSON.stringify(guestFiltersToWhere({ ...DEFAULT_FILTERS, special: 'plusOne' })),
    ).toContain('isPlusOne')
  })
})
