import { formatWeddingTime } from '@/domain/wedding/countdown'
import type { ItineraryEntry } from '@/domain/itinerary/item'
import { cn } from '@/lib/cn'

/**
 * The order of the day.
 *
 * A description list rather than a table: on a phone this reads as a vertical timeline,
 * and screen readers announce each time with its event rather than as grid coordinates.
 */
export function Timeline({
  entries,
  timezone,
  className,
}: {
  entries: readonly ItineraryEntry[]
  timezone: string
  className?: string
}) {
  if (entries.length === 0) return null

  return (
    <dl className={cn('space-y-6', className)}>
      {entries.map((entry) => {
        const start = formatWeddingTime(entry.startTime, timezone)
        const end = formatWeddingTime(entry.endTime, timezone)

        return (
          <div key={entry.id} className="grid grid-cols-[5.5rem_1fr] gap-4 sm:grid-cols-[7rem_1fr]">
            <dt className="pt-0.5 text-sm tabular-nums text-guest-muted">
              {start ?? <span aria-hidden="true">—</span>}
              {end ? <span className="block text-xs">until {end}</span> : null}
            </dt>
            <dd>
              <p className="font-guest-display text-xl">{entry.title}</p>
              {entry.location ? (
                <p className="mt-0.5 text-sm text-guest-muted">{entry.location}</p>
              ) : null}
              {entry.description ? (
                <p className="mt-1.5 whitespace-pre-line">{entry.description}</p>
              ) : null}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
