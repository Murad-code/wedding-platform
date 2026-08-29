import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PageShell } from '@/components/guest/page-shell'
import { Timeline } from '@/components/guest/timeline'
import { VenueCard } from '@/components/guest/venue-card'
import { formatWeddingDate } from '@/domain/wedding/countdown'
import { getItinerary } from '@/lib/wedding-content'
import { getWeddingSettings } from '@/lib/wedding'

export const metadata: Metadata = { title: 'Our day' }
export const dynamic = 'force-dynamic'

export default async function OurDayPage() {
  const settings = await getWeddingSettings()
  if (!settings.isConfigured) notFound()

  // Public audience: internal supplier timings never leave the server.
  const itinerary = settings.features.itinerary ? await getItinerary('public') : []
  const date = formatWeddingDate(settings.weddingDate, settings.timezone)

  return (
    <PageShell settings={settings} title="Our day" intro={date}>
      <div className="space-y-10">
        <VenueCard heading="The ceremony" venue={settings.ceremony} timezone={settings.timezone} />
        <VenueCard
          heading="The reception"
          venue={settings.reception}
          timezone={settings.timezone}
        />

        {itinerary.length > 0 ? (
          <section aria-labelledby="timeline-heading">
            <h2 id="timeline-heading" className="font-guest-display text-2xl">
              The order of the day
            </h2>
            <Timeline entries={itinerary} timezone={settings.timezone} className="mt-6" />
          </section>
        ) : null}

        {settings.dressCode ? (
          <section aria-labelledby="dress-heading">
            <h2 id="dress-heading" className="font-guest-display text-2xl">
              Dress code
            </h2>
            <p className="mt-3">{settings.dressCode}</p>
          </section>
        ) : null}
      </div>
    </PageShell>
  )
}
