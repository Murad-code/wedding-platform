import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PageShell } from '@/components/guest/page-shell'
import { VenueCard } from '@/components/guest/venue-card'
import { getWeddingSettings } from '@/lib/wedding'

export const metadata: Metadata = { title: 'Venue & travel' }
export const dynamic = 'force-dynamic'

export default async function VenuePage() {
  const settings = await getWeddingSettings()
  if (!settings.isConfigured) notFound()

  const sections = [
    settings.features.travel
      ? { heading: 'Getting there', body: settings.travelInformation }
      : null,
    settings.features.travel ? { heading: 'Parking', body: settings.parkingInformation } : null,
    settings.features.accommodation
      ? { heading: 'Where to stay', body: settings.accommodationInformation }
      : null,
  ].filter((section): section is { heading: string; body: string } =>
    Boolean(section && section.body),
  )

  return (
    <PageShell settings={settings} title="Venue & travel">
      <div className="space-y-10">
        <VenueCard heading="The ceremony" venue={settings.ceremony} timezone={settings.timezone} />
        <VenueCard
          heading="The reception"
          venue={settings.reception}
          timezone={settings.timezone}
        />

        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="font-guest-display text-2xl">{section.heading}</h2>
            <p className="mt-3 whitespace-pre-line">{section.body}</p>
          </section>
        ))}
      </div>
    </PageShell>
  )
}
