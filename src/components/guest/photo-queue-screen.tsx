'use client'

import Link from 'next/link'

import { ConnectionBadge } from '@/components/photo-queue/connection-badge'
import { usePhotoQueue } from '@/components/photo-queue/use-photo-queue'
import {
  buildGuestView,
  describeDistance,
  type QueuePosition,
  type QueueSnapshot,
} from '@/domain/photo-queue/queue'

/**
 * The guest's wedding-day screen.
 *
 * One glanceable page, read from arm's length while holding a drink. Emphasis rises with
 * proximity: a group several away is calm and grey, the next group is prominent and told
 * to start walking, and being called is unmistakable (docs/UX.md §4.2).
 */
export function PhotoQueueScreen({
  initial,
  myGroupIds,
  coupleNames,
  hasInvitation,
}: {
  initial: QueueSnapshot
  myGroupIds: number[]
  coupleNames: string | null
  hasInvitation: boolean
}) {
  const { snapshot, connection } = usePhotoQueue(initial)
  const view = buildGuestView(snapshot.groups, myGroupIds)

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4">
        <Link href="/" className="font-guest-display text-sm tracking-wide hover:opacity-80">
          {coupleNames ?? 'Our wedding'}
        </Link>
        <ConnectionBadge state={connection} className="text-xs font-medium text-guest-muted" />
      </header>

      <main className="flex flex-1 flex-col justify-center gap-8 py-10 text-center">
        {snapshot.groups.length === 0 ? (
          <p className="text-guest-muted">The photographs have not been planned yet.</p>
        ) : view.summary.isFinished ? (
          <p className="font-guest-display text-2xl">
            That is every photograph done. Thank you — go and enjoy the party.
          </p>
        ) : (
          <>
            <section aria-labelledby="now-heading">
              <h2
                id="now-heading"
                className="text-xs font-semibold uppercase tracking-[0.3em] text-guest-muted"
              >
                Now
              </h2>
              <p className="mt-3 font-guest-display text-3xl text-balance sm:text-4xl">
                {view.now ? view.now.name : 'Photographs have not started'}
              </p>
              {view.now?.description ? (
                <p className="mt-2 text-sm text-guest-muted">{view.now.description}</p>
              ) : null}
            </section>

            <section aria-labelledby="next-heading">
              <h2
                id="next-heading"
                className="text-xs font-semibold uppercase tracking-[0.3em] text-guest-muted"
              >
                Up next
              </h2>
              <p className="mt-2 font-guest-display text-xl text-balance text-guest-muted">
                {view.upNext ? view.upNext.name : 'Nothing else in the queue'}
              </p>
            </section>
          </>
        )}

        {view.yourGroups.length > 0 ? (
          <section aria-labelledby="yours-heading" className="border-t border-guest-border pt-8">
            <h2
              id="yours-heading"
              className="text-xs font-semibold uppercase tracking-[0.3em] text-guest-muted"
            >
              {view.yourGroups.length === 1 ? 'Your photo' : 'Your photos'}
            </h2>
            <ul className="mt-3 space-y-4">
              {view.yourGroups.map((position) => (
                <li key={position.group.id}>
                  <YourGroup position={position} />
                </li>
              ))}
            </ul>
          </section>
        ) : hasInvitation ? (
          <p className="border-t border-guest-border pt-8 text-sm text-guest-muted">
            You are not in any of the group photographs, so there is nothing you need to do.
          </p>
        ) : (
          <p className="border-t border-guest-border pt-8 text-sm text-guest-muted">
            Open the link from your invitation to see when your own photograph is coming up.
          </p>
        )}
      </main>
    </div>
  )
}

function YourGroup({ position }: { position: QueuePosition }) {
  const { group, groupsAway } = position
  const sentence = describeDistance(position)

  // Three visual registers, matched to how urgent this actually is.
  const tone =
    groupsAway === 0
      ? 'border-guest-accent bg-guest-accent/10'
      : groupsAway === 1
        ? 'border-guest-accent/60'
        : 'border-guest-border'

  return (
    <div data-groups-away={groupsAway ?? 'done'} className={`rounded-xl border p-4 ${tone}`}>
      <p
        className={
          groupsAway === 0
            ? 'font-guest-display text-2xl'
            : 'font-guest-display text-lg text-balance'
        }
      >
        {group.name}
      </p>
      {/* Announced as it changes: a guest may have the page open in a pocket. */}
      <p
        role="status"
        aria-live="polite"
        className={
          groupsAway !== null && groupsAway <= 1
            ? 'mt-1 text-sm font-medium'
            : 'mt-1 text-sm text-guest-muted'
        }
      >
        {sentence}
      </p>
    </div>
  )
}
