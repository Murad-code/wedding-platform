import type { Metadata } from 'next'
import Link from 'next/link'

import { AddItineraryItemForm } from '@/components/organiser/add-itinerary-item-form'
import { DeleteItineraryItemButton } from '@/components/organiser/delete-itinerary-item-button'
import { formatWeddingTime } from '@/domain/wedding/countdown'
import { requireOrganiser } from '@/lib/auth/session'
import { getItinerary } from '@/lib/wedding-content'
import { getWeddingSettings } from '@/lib/wedding'

export const metadata: Metadata = { title: 'Itinerary' }
export const dynamic = 'force-dynamic'

const VISIBILITY_LABEL: Record<string, string> = {
  public: 'Everyone',
  guests: 'Invited guests',
  internal: 'Internal only',
}

export default async function ItineraryPage() {
  await requireOrganiser()

  const [settings, entries] = await Promise.all([
    getWeddingSettings(),
    // Organisers see everything, including internal supplier timings.
    getItinerary('organiser'),
  ])

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-organiser-muted">
        <Link href="/dashboard" className="hover:underline">
          Dashboard
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Itinerary</span>
      </nav>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight">The order of the day</h1>
      <p className="mt-1 text-sm text-organiser-muted">
        Lower order numbers appear first. Internal items are for your own planning and never reach
        the guest website.
      </p>

      <section className="mt-8" aria-labelledby="items-heading">
        <h2 id="items-heading" className="sr-only">
          Itinerary items
        </h2>

        {entries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-organiser-border p-8 text-center text-sm text-organiser-muted">
            Nothing scheduled yet. Add the first moment below. Guest arrival is a good start.
          </p>
        ) : (
          <ul className="divide-y divide-organiser-border overflow-hidden rounded-lg border border-organiser-border bg-organiser-surface">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-start gap-4 px-4 py-3">
                <span className="w-20 shrink-0 pt-0.5 text-sm tabular-nums text-organiser-muted">
                  {formatWeddingTime(entry.startTime, settings.timezone) ?? '—'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{entry.title}</p>
                  {entry.location ? (
                    <p className="text-sm text-organiser-muted">{entry.location}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-organiser-muted">
                    #{entry.order} · {VISIBILITY_LABEL[entry.visibility] ?? entry.visibility}
                  </p>
                </div>
                <DeleteItineraryItemButton id={entry.id} title={entry.title} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <AddItineraryItemForm className="mt-6" nextOrder={(entries.at(-1)?.order ?? 0) + 10} />
    </div>
  )
}
