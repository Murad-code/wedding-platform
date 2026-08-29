import config from '@payload-config'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { EditGuestForm } from '@/components/organiser/edit-guest-form'
import { guestDisplayName } from '@/domain/guests/guest'
import { requireOrganiser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Guest' }
export const dynamic = 'force-dynamic'

export default async function GuestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOrganiser()

  const { id } = await params
  const guestId = Number(id)
  if (!Number.isInteger(guestId) || guestId <= 0) notFound()

  const payload = await getPayload({ config })
  const guest = await payload
    .findByID({ collection: 'guests', id: guestId, depth: 1, overrideAccess: true })
    .catch(() => null)

  if (!guest) notFound()

  const party =
    guest.party && typeof guest.party === 'object'
      ? { id: guest.party.id, name: guest.party.displayName }
      : null

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-organiser-muted">
        <Link href="/dashboard/guests" className="hover:underline">
          Guest list
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{guestDisplayName(guest.firstName, guest.lastName ?? null)}</span>
      </nav>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight">
        {guestDisplayName(guest.firstName, guest.lastName ?? null)}
      </h1>
      {party ? (
        <p className="mt-1 text-sm text-organiser-muted">
          In{' '}
          <Link href={`/dashboard/parties/${party.id}`} className="underline">
            {party.name}
          </Link>
        </p>
      ) : null}

      <EditGuestForm
        className="mt-8"
        guest={{
          id: guest.id,
          firstName: guest.firstName,
          lastName: guest.lastName ?? '',
          ageGroup: guest.ageGroup,
          rsvpStatus: guest.rsvpStatus,
          isPlusOne: guest.isPlusOne === true,
          email: guest.email ?? '',
          phone: guest.phone ?? '',
          dietaryRequirements: guest.dietaryRequirements ?? '',
          allergies: guest.allergies ?? '',
          accessibilityNeeds: guest.accessibilityNeeds ?? '',
          internalNotes: guest.internalNotes ?? '',
        }}
      />
    </div>
  )
}
