import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { PhotoQueueScreen } from '@/components/guest/photo-queue-screen'
import { findPartyByToken } from '@/lib/invitations'
import { getSnapshot, groupIdsForGuests } from '@/lib/photo-queue'
import { clientIp, invitationFailureLimiter } from '@/lib/rate-limit'
import { getWeddingSettings } from '@/lib/wedding'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Your photographs',
  // The URL carries the invitation token, so this must never be indexed.
  robots: { index: false, follow: false },
}

/**
 * The photo queue as one party sees it, including which photographs they are in.
 *
 * Membership is resolved here, on the server, into a list of group ids. The browser
 * learns which groups are the guest's own and nothing about who else is in them.
 */
export default async function PartyPhotosPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const settings = await getWeddingSettings()
  if (!settings.isConfigured || !settings.features.photoQueue) notFound()

  const party = await findPartyByToken(token)

  if (!party) {
    // Only failures are throttled: a room full of guests shares one address, and a
    // stream of failures is what enumeration looks like (ADR-016).
    invitationFailureLimiter.check(clientIp(await headers()))
    notFound()
  }

  const [snapshot, myGroupIds] = await Promise.all([
    getSnapshot(),
    groupIdsForGuests(party.guests.map((guest) => guest.id)),
  ])

  return (
    <PhotoQueueScreen
      initial={snapshot}
      myGroupIds={myGroupIds}
      coupleNames={settings.coupleNames}
      hasInvitation
    />
  )
}
