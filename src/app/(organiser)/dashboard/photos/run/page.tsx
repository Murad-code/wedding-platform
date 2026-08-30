import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { QueueController, type GroupMembers } from '@/components/organiser/queue-controller'
import { toPublicGroup } from '@/domain/photo-queue/queue'
import { requireOrganiser } from '@/lib/auth/session'
import { getPhotoGroups, getPhotographableGuests, getRevision } from '@/lib/photo-queue'
import { getWeddingSettings } from '@/lib/wedding'

export const metadata: Metadata = { title: 'Wedding-day controller' }
export const dynamic = 'force-dynamic'

export default async function PhotoQueueControllerPage() {
  await requireOrganiser()

  const settings = await getWeddingSettings()
  if (!settings.features.photoQueue) notFound()

  const [groups, guests, revision] = await Promise.all([
    getPhotoGroups(),
    getPhotographableGuests(),
    getRevision(),
  ])

  const names = new Map(guests.map((guest) => [guest.id, guest.displayName]))

  // Membership is attached here rather than carried on the stream: the photographer
  // needs the names, and the stream is public.
  const members: GroupMembers = Object.fromEntries(
    groups.map((group) => [
      group.id,
      group.memberIds.map((id) => names.get(id)).filter((name) => name !== undefined),
    ]),
  )

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="text-sm text-organiser-muted">
        <Link href="/dashboard/photos" className="hover:underline">
          Photographs
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Controller</span>
      </nav>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Wedding-day controller</h1>

      {groups.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-organiser-border p-6 text-center text-sm text-organiser-muted">
          There are no photographs to run yet.{' '}
          <Link href="/dashboard/photos" className="underline">
            Set up the running order
          </Link>{' '}
          first.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-organiser-muted">
            Everything here updates on every guest’s phone the moment you press it.
          </p>
          <QueueController
            initial={{ revision, groups: groups.map(toPublicGroup) }}
            members={members}
            className="mt-6"
          />
        </>
      )}
    </div>
  )
}
