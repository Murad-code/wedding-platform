import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { InvitationView } from '@/components/guest/invitation-view'
import { isRsvpOpen } from '@/domain/wedding/settings'
import { clientIp, invitationFailureLimiter } from '@/lib/rate-limit'
import { findPartyByToken } from '@/lib/invitations'
import { getItinerary } from '@/lib/wedding-content'
import { getWeddingSettings } from '@/lib/wedding'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Your invitation',
  // Invitation pages must never be indexed; the URL is the credential.
  robots: { index: false, follow: false },
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const requestHeaders = await headers()
  const party = await findPartyByToken(token)

  if (!party) {
    // Only failures count against the limiter. Guests at one venue share an IP, so
    // throttling successful lookups would lock out the whole room; a stream of failures
    // is what enumeration actually looks like.
    invitationFailureLimiter.check(clientIp(requestHeaders))
    // Unknown, malformed, rotated, and rate-limited all land here identically.
    notFound()
  }

  const settings = await getWeddingSettings()

  // Invited guests see public *and* guests-only items; internal supplier timings are
  // filtered out server-side and never reach the browser.
  const itinerary = settings.features.itinerary ? await getItinerary('invited') : []

  return (
    <InvitationView
      party={party}
      settings={settings}
      rsvpOpen={isRsvpOpen(settings)}
      token={token}
      itinerary={itinerary}
    />
  )
}
