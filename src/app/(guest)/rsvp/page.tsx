import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PageShell } from '@/components/guest/page-shell'
import { isRsvpOpen } from '@/domain/wedding/settings'
import { formatWeddingDate } from '@/domain/wedding/countdown'
import { getWeddingSettings } from '@/lib/wedding'

export const metadata: Metadata = {
  title: 'RSVP',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

/**
 * Explains that RSVP happens through a personal link.
 *
 * Deliberately offers no way to look yourself up: a guest-name search would be an
 * enumeration route into the guest list (docs/SECURITY.md §3).
 */
export default async function RsvpPage() {
  const settings = await getWeddingSettings()
  if (!settings.isConfigured || !settings.features.rsvp) notFound()

  const open = isRsvpOpen(settings)
  const deadline = formatWeddingDate(settings.rsvpDeadline, settings.timezone)

  return (
    <PageShell settings={settings} title="RSVP">
      <div className="space-y-5 text-lg leading-relaxed">
        {open ? (
          <>
            <p>
              Everyone invited has their own private link. Look for it in the message or invitation
              you received from us. Opening it will show your names and let you reply for everyone
              in your group.
            </p>
            {deadline ? (
              <p className="text-guest-muted">
                Please let us know by <strong className="font-medium">{deadline}</strong>. You can
                change your answer any time before then.
              </p>
            ) : null}
            <p className="text-guest-muted">
              If you cannot find your link, send us a message and we will send it again.
            </p>
          </>
        ) : (
          <>
            <p>Our RSVP deadline has now passed.</p>
            <p className="text-guest-muted">
              If something has changed, please contact us directly so we can let the venue know.
            </p>
          </>
        )}
      </div>
    </PageShell>
  )
}
