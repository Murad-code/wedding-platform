export const ITINERARY_VISIBILITY = ['public', 'guests', 'internal'] as const
export type ItineraryVisibility = (typeof ITINERARY_VISIBILITY)[number]

export function isItineraryVisibility(value: unknown): value is ItineraryVisibility {
  return typeof value === 'string' && (ITINERARY_VISIBILITY as readonly string[]).includes(value)
}

export type ItineraryEntry = {
  id: number
  title: string
  description: string | null
  startTime: string | null
  endTime: string | null
  location: string | null
  visibility: ItineraryVisibility
  order: number
}

/** Who is looking at the timeline. */
export type Audience = 'public' | 'invited' | 'organiser'

/**
 * Filters the timeline for an audience.
 *
 * `internal` items are supplier timings — florist arrives, band soundcheck — that exist
 * for the couple's own planning. Leaking them onto the public site would be noise at
 * best and a security-through-obscurity problem at worst, so the filter runs server-side
 * and internal items are never sent to a guest at all.
 */
export function visibleTo(
  entries: readonly ItineraryEntry[],
  audience: Audience,
): ItineraryEntry[] {
  const allowed: Record<Audience, ItineraryVisibility[]> = {
    public: ['public'],
    invited: ['public', 'guests'],
    organiser: ['public', 'guests', 'internal'],
  }

  return entries.filter((entry) => allowed[audience].includes(entry.visibility))
}

/**
 * Orders the timeline.
 *
 * `order` is authoritative because an organiser may deliberately place an item without a
 * time, or place two items in a particular sequence within the same minute. Start time
 * breaks ties so a newly added item lands somewhere sensible before being reordered.
 */
export function sortEntries(entries: readonly ItineraryEntry[]): ItineraryEntry[] {
  return [...entries].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order
    if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime)
    if (a.startTime) return -1
    if (b.startTime) return 1
    return a.id - b.id
  })
}
