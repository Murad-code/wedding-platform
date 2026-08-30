import config from '@payload-config'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { AddGuestForm } from '@/components/organiser/add-guest-form'
import { InvitationLink } from '@/components/organiser/invitation-link'
import { guestDisplayName } from '@/domain/guests/guest'
import { requireOrganiser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Invitation party' }
export const dynamic = 'force-dynamic'

const RSVP_LABEL: Record<string, string> = {
  pending: 'Awaiting reply',
  attending: 'Attending',
  declined: 'Declined',
}

export default async function PartyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOrganiser()

  const { id } = await params
  const partyId = Number(id)
  if (!Number.isInteger(partyId) || partyId <= 0) notFound()

  const payload = await getPayload({ config })

  const party = await payload
    .findByID({
      collection: 'invitation-parties',
      id: partyId,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null)

  if (!party) notFound()

  const guests = await payload.find({
    collection: 'guests',
    where: { party: { equals: partyId } },
    limit: 100,
    sort: 'id',
    depth: 0,
    overrideAccess: true,
  })

  const hasInvitation = Boolean(party.tokenHash)

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-organiser-muted">
        <Link href="/dashboard/parties" className="hover:underline">
          Invitation parties
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{party.displayName}</span>
      </nav>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{party.displayName}</h1>

      <section className="mt-8" aria-labelledby="guests-heading">
        <h2 id="guests-heading" className="text-lg font-semibold">
          Guests
        </h2>

        {guests.totalDocs === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-organiser-border p-6 text-center text-sm text-organiser-muted">
            No guests in this party yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-organiser-border overflow-hidden rounded-lg border border-organiser-border bg-organiser-surface">
            {guests.docs.map((guest) => (
              <li key={guest.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="font-medium">
                    {guestDisplayName(guest.firstName, guest.lastName ?? null)}
                  </p>
                  {guest.dietaryRequirements || guest.allergies ? (
                    <p className="mt-0.5 text-xs text-status-pending">
                      {[guest.allergies, guest.dietaryRequirements].filter(Boolean).join(' · ')}
                    </p>
                  ) : null}
                </div>
                <span className="text-sm" data-rsvp-status={guest.rsvpStatus}>
                  {RSVP_LABEL[guest.rsvpStatus] ?? guest.rsvpStatus}
                </span>
              </li>
            ))}
          </ul>
        )}

        <AddGuestForm partyId={partyId} className="mt-4" />
      </section>

      <section className="mt-10" aria-labelledby="invitation-heading">
        <h2 id="invitation-heading" className="text-lg font-semibold">
          Invitation link
        </h2>
        <p className="mt-1 text-sm text-organiser-muted">
          Anyone with this link can see and answer this party’s invitation, so share it only with
          them. We never store the link itself. Issuing a new one replaces the old.
        </p>
        <InvitationLink partyId={partyId} hasInvitation={hasInvitation} className="mt-4" />
      </section>
    </div>
  )
}
