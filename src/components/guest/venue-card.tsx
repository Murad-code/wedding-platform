import { formatWeddingTime } from '@/domain/wedding/countdown'
import type { Venue } from '@/domain/wedding/settings'

/** Renders nothing at all when the organiser has not filled a venue in. */
export function VenueCard({
  heading,
  venue,
  timezone,
}: {
  heading: string
  venue: Venue
  timezone: string
}) {
  const hasContent = venue.venueName || venue.address || venue.startTime || venue.notes
  if (!hasContent) return null

  const time = formatWeddingTime(venue.startTime, timezone)

  return (
    <section aria-labelledby={`${heading.replace(/\s+/g, '-').toLowerCase()}-heading`}>
      <h2
        id={`${heading.replace(/\s+/g, '-').toLowerCase()}-heading`}
        className="font-guest-display text-2xl"
      >
        {heading}
      </h2>

      <div className="mt-3 space-y-1">
        {time ? <p className="text-lg">{time}</p> : null}
        {venue.venueName ? <p className="font-medium">{venue.venueName}</p> : null}
        {venue.address ? (
          <address className="text-guest-muted not-italic whitespace-pre-line">
            {venue.address}
          </address>
        ) : null}
        {venue.notes ? <p className="mt-2 whitespace-pre-line">{venue.notes}</p> : null}
        {venue.mapUrl ? (
          <p className="mt-3">
            <a
              href={venue.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:no-underline"
            >
              Open in maps
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </p>
        ) : null}
      </div>
    </section>
  )
}
