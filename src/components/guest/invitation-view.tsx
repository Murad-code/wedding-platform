import type { ItineraryEntry } from '@/domain/itinerary/item'
import type { WeddingSettingsView } from '@/domain/wedding/settings'
import type { ResolvedParty } from '@/lib/invitations'

import { RsvpForm } from './rsvp-form'
import { Timeline } from './timeline'

function formatWeddingDate(iso: string | null, timezone: string): string | null {
  if (!iso) return null
  // Rendered in the wedding's timezone, never the viewer's, so a guest abroad sees the
  // ceremony time the couple actually meant (docs/UX.md §8).
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: timezone,
  }).format(new Date(iso))
}

export function InvitationView({
  party,
  settings,
  rsvpOpen,
  token,
  itinerary = [],
}: {
  party: ResolvedParty
  settings: WeddingSettingsView
  rsvpOpen: boolean
  token: string
  itinerary?: ItineraryEntry[]
}) {
  const date = formatWeddingDate(settings.weddingDate, settings.timezone)
  const hasResponded = party.respondedAt !== null

  return (
    <main className="mx-auto max-w-xl px-6 py-12 sm:py-20">
      <header className="text-center">
        {settings.coupleNames ? (
          <p className="font-guest-body text-xs tracking-[0.25em] text-guest-muted uppercase">
            {settings.coupleNames}
          </p>
        ) : null}
        <h1 className="mt-4 font-guest-display text-4xl leading-tight text-balance sm:text-5xl">
          You’re invited
        </h1>
        <p className="mt-5 text-lg text-guest-muted">{party.displayName}</p>
      </header>

      <section className="mt-10 rounded-2xl border border-guest-border bg-guest-surface p-6 text-center">
        <dl className="space-y-4">
          {date ? (
            <div>
              <dt className="text-xs tracking-widest text-guest-muted uppercase">When</dt>
              <dd className="mt-1 font-guest-display text-xl">{date}</dd>
            </div>
          ) : null}
          {settings.ceremony.venueName ? (
            <div>
              <dt className="text-xs tracking-widest text-guest-muted uppercase">Where</dt>
              <dd className="mt-1 font-guest-display text-xl">{settings.ceremony.venueName}</dd>
              {settings.ceremony.address ? (
                <dd className="mt-1 text-sm whitespace-pre-line text-guest-muted">
                  {settings.ceremony.address}
                </dd>
              ) : null}
            </div>
          ) : null}
          {settings.dressCode ? (
            <div>
              <dt className="text-xs tracking-widest text-guest-muted uppercase">Dress code</dt>
              <dd className="mt-1">{settings.dressCode}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {settings.welcomeMessage ? (
        <p className="mt-10 text-center text-lg leading-relaxed whitespace-pre-line">
          {settings.welcomeMessage}
        </p>
      ) : null}

      {itinerary.length > 0 ? (
        <section className="mt-12" aria-labelledby="timeline-heading">
          <h2 id="timeline-heading" className="font-guest-display text-2xl">
            The order of the day
          </h2>
          <Timeline entries={itinerary} timezone={settings.timezone} className="mt-6" />
        </section>
      ) : null}

      <section className="mt-12" aria-labelledby="rsvp-heading">
        <h2 id="rsvp-heading" className="font-guest-display text-2xl">
          {hasResponded ? 'Your response' : 'Will you join us?'}
        </h2>

        {rsvpOpen ? (
          <RsvpForm party={party} token={token} hasResponded={hasResponded} />
        ) : (
          <p className="mt-4 rounded-xl border border-guest-border bg-guest-surface p-4 text-guest-muted">
            The RSVP deadline has passed. Please contact the couple directly if you need to change
            anything.
          </p>
        )}
      </section>
    </main>
  )
}
