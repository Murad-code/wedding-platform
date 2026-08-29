import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { InvitationView } from '@/components/guest/invitation-view'
import { isRsvpOpen } from '@/domain/wedding/settings'
import { clientIp, invitationLookupLimiter } from '@/lib/rate-limit'
import { findPartyByToken } from '@/lib/invitations'
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
  const { allowed } = invitationLookupLimiter.check(clientIp(requestHeaders))
  // A blocked request is indistinguishable from an unknown token, so probing gains
  // nothing from the difference.
  if (!allowed) notFound()

  const party = await findPartyByToken(token)
  // Unknown, malformed, and rotated tokens all land here identically.
  if (!party) notFound()

  const settings = await getWeddingSettings()

  return (
    <InvitationView
      party={party}
      settings={settings}
      rsvpOpen={isRsvpOpen(settings)}
      token={token}
    />
  )
}
