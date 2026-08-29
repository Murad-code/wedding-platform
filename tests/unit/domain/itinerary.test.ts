import { describe, expect, it } from 'vitest'

import {
  isItineraryVisibility,
  sortEntries,
  visibleTo,
  type ItineraryEntry,
} from '@/domain/itinerary/item'

function entry(partial: Partial<ItineraryEntry> & { id: number }): ItineraryEntry {
  return {
    title: `Item ${partial.id}`,
    description: null,
    startTime: null,
    endTime: null,
    location: null,
    visibility: 'guests',
    order: 0,
    ...partial,
  }
}

describe('isItineraryVisibility', () => {
  it('accepts the known values and rejects anything else', () => {
    expect(isItineraryVisibility('public')).toBe(true)
    expect(isItineraryVisibility('guests')).toBe(true)
    expect(isItineraryVisibility('internal')).toBe(true)
    expect(isItineraryVisibility('Public')).toBe(false)
    expect(isItineraryVisibility(null)).toBe(false)
  })
})

describe('visibleTo', () => {
  const entries = [
    entry({ id: 1, visibility: 'public' }),
    entry({ id: 2, visibility: 'guests' }),
    entry({ id: 3, visibility: 'internal' }),
  ]

  it('shows only public items on the public site', () => {
    expect(visibleTo(entries, 'public').map((e) => e.id)).toEqual([1])
  })

  it('shows public and guest items to an invited guest', () => {
    expect(visibleTo(entries, 'invited').map((e) => e.id)).toEqual([1, 2])
  })

  it('shows everything to an organiser', () => {
    expect(visibleTo(entries, 'organiser').map((e) => e.id)).toEqual([1, 2, 3])
  })

  it('never leaks internal supplier timings to a guest audience', () => {
    // The highest-consequence case: florist arrival times are not guest content.
    for (const audience of ['public', 'invited'] as const) {
      expect(visibleTo(entries, audience).some((e) => e.visibility === 'internal')).toBe(false)
    }
  })

  it('handles an empty timeline', () => {
    expect(visibleTo([], 'invited')).toEqual([])
  })
})

describe('sortEntries', () => {
  it('orders by the explicit order field', () => {
    const sorted = sortEntries([entry({ id: 1, order: 20 }), entry({ id: 2, order: 10 })])
    expect(sorted.map((e) => e.id)).toEqual([2, 1])
  })

  it('breaks ties on start time', () => {
    const sorted = sortEntries([
      entry({ id: 1, order: 0, startTime: '2027-06-12T15:00:00Z' }),
      entry({ id: 2, order: 0, startTime: '2027-06-12T13:00:00Z' }),
    ])
    expect(sorted.map((e) => e.id)).toEqual([2, 1])
  })

  it('places timed items before untimed ones at the same order', () => {
    const sorted = sortEntries([
      entry({ id: 1, order: 0 }),
      entry({ id: 2, order: 0, startTime: '2027-06-12T13:00:00Z' }),
    ])
    expect(sorted.map((e) => e.id)).toEqual([2, 1])
  })

  it('is stable by id when order and time are equal', () => {
    const sorted = sortEntries([entry({ id: 5, order: 0 }), entry({ id: 2, order: 0 })])
    expect(sorted.map((e) => e.id)).toEqual([2, 5])
  })

  it('respects an explicit order even when it contradicts the times', () => {
    // An organiser may deliberately place an item out of chronological order.
    const sorted = sortEntries([
      entry({ id: 1, order: 10, startTime: '2027-06-12T18:00:00Z' }),
      entry({ id: 2, order: 20, startTime: '2027-06-12T13:00:00Z' }),
    ])
    expect(sorted.map((e) => e.id)).toEqual([1, 2])
  })

  it('does not mutate its input', () => {
    const input = [entry({ id: 1, order: 20 }), entry({ id: 2, order: 10 })]
    sortEntries(input)
    expect(input.map((e) => e.id)).toEqual([1, 2])
  })
})
