import type { Metadata } from 'next'

import { Countdown } from '@/components/guest/countdown'
import { guestNavItems, SiteNav } from '@/components/guest/site-nav'
import { calendarDaysUntil, formatWeddingDate, formatWeddingTime } from '@/domain/wedding/countdown'
import { getWeddingSettings } from '@/lib/wedding'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getWeddingSettings()
  if (!settings.coupleNames) return { title: 'Our wedding' }

  return {
    title: `${settings.coupleNames}`,
    description: settings.welcomeMessage ?? `Join us to celebrate our wedding.`,
  }
}

export default async function HomePage() {
  const settings = await getWeddingSettings()

  if (!settings.isConfigured) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center px-6 text-center">
        <p className="text-sm tracking-[0.2em] text-guest-muted uppercase">Wedding Platform</p>
        <h1 className="mt-6 font-guest-display text-4xl leading-tight text-balance sm:text-5xl">
          The wedding website has not been configured yet
        </h1>
        <p className="mt-6 max-w-md text-guest-muted">
          An organiser needs to add the wedding details before this page has anything to show.
        </p>
      </main>
    )
  }

  const date = formatWeddingDate(settings.weddingDate, settings.timezone)
  const time = formatWeddingTime(settings.ceremony.startTime, settings.timezone)
  const daysAway = calendarDaysUntil(settings.weddingDate, settings.timezone)
  const nav = guestNavItems(settings.features)

  return (
    <div className="min-h-dvh">
      <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-6 py-16 text-center">
        <p className="text-xs tracking-[0.3em] text-guest-muted uppercase">
          {daysAway !== null && daysAway > 0
            ? 'We’re getting married'
            : daysAway === 0
              ? 'Today’s the day'
              : 'We got married'}
        </p>

        <h1 className="mt-6 font-guest-display text-5xl leading-[1.05] text-balance sm:text-7xl">
          {settings.partnerOneName}
          <span className="mx-3 font-normal text-guest-muted">&</span>
          {settings.partnerTwoName}
        </h1>

        {date ? (
          <p className="mt-8 font-guest-display text-2xl sm:text-3xl">
            {date}
            {time ? <span className="text-guest-muted"> · {time}</span> : null}
          </p>
        ) : null}

        {settings.ceremony.venueName ? (
          <p className="mt-2 text-guest-muted">{settings.ceremony.venueName}</p>
        ) : null}

        <Countdown weddingDate={settings.weddingDate} className="mt-12" />

        {settings.welcomeMessage ? (
          <p className="mx-auto mt-12 max-w-xl text-lg leading-relaxed whitespace-pre-line">
            {settings.welcomeMessage}
          </p>
        ) : null}

        <SiteNav items={nav} className="mt-16" />
      </main>
    </div>
  )
}
