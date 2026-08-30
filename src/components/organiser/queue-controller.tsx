'use client'

import { useState, useTransition } from 'react'

import { performQueueAction } from '@/app/(organiser)/dashboard/photos/actions'
import type { AlertSummary } from '@/lib/photo-queue'
import { ConnectionBadge } from '@/components/photo-queue/connection-badge'
import { usePhotoQueue } from '@/components/photo-queue/use-photo-queue'
import {
  currentGroup,
  previousGroup,
  summarise,
  upNextGroup,
  type QueueAction,
  type QueueSnapshot,
} from '@/domain/photo-queue/queue'

/** Names are supplied by the server; the live stream deliberately carries no membership. */
export type GroupMembers = Record<number, string[]>

const ACTION_LABELS: Record<QueueAction, string> = {
  previous: 'Previous',
  'call-next': 'Call next',
  complete: 'Complete',
  skip: 'Skip',
}

export function QueueController({
  initial,
  members,
  className,
}: {
  initial: QueueSnapshot
  members: GroupMembers
  className?: string
}) {
  const { snapshot, connection, applySnapshot } = usePhotoQueue(initial)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState('')
  const [unreachable, setUnreachable] = useState(0)

  const groups = snapshot.groups
  const current = currentGroup(groups)
  const upNext = upNextGroup(groups)
  const previous = previousGroup(groups)
  const summary = summarise(groups)

  const run = (action: QueueAction) => {
    startTransition(async () => {
      // The revision the organiser was actually looking at travels with the press, so a
      // second controller that has already moved the queue on cannot be overwritten.
      const result = await performQueueAction(action, snapshot.revision)
      applySnapshot(result.snapshot)

      if (!result.ok) {
        setMessage(result.error)
        return
      }

      const next = currentGroup(result.snapshot.groups)
      const where = next
        ? `Now photographing ${next.name}.`
        : 'Nobody is being photographed at the moment.'

      setUnreachable(result.alerts.unreachable)
      setMessage(`${where} ${describeAlerts(result.alerts)}`)
    })
  }

  const disabled: Record<QueueAction, boolean> = {
    previous: !previous,
    'call-next': !current && !upNext,
    complete: !current,
    skip: !current && !upNext,
  }

  return (
    <div
      data-revision={snapshot.revision}
      // A press re-renders this subtree, and a second press landing during that render
      // can be dispatched at a DOM node React is replacing — the handler never runs. The
      // buttons disable while a press is in flight; this states the same thing in a way a
      // test can wait for, rather than waiting on a guess.
      data-pending={pending ? 'true' : 'false'}
      className={className}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-organiser-muted">
          {summary.completed + summary.skipped} of {summary.total} done
          {summary.skipped > 0 ? ` · ${summary.skipped} skipped` : ''}
        </p>
        <ConnectionBadge state={connection} />
      </div>

      <section
        aria-labelledby="now-heading"
        className="mt-4 rounded-xl border-2 border-organiser-accent bg-organiser-surface p-6 text-center"
      >
        <h2
          id="now-heading"
          className="text-xs font-semibold uppercase tracking-widest text-organiser-muted"
        >
          Now
        </h2>
        {current ? (
          <>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{current.name}</p>
            <MemberList names={members[current.id] ?? []} />
            {current.description ? (
              <p className="mt-2 text-sm text-organiser-muted">{current.description}</p>
            ) : null}
          </>
        ) : (
          <p className="mt-2 text-lg text-organiser-muted">
            {summary.isFinished
              ? 'All done — every photograph has been taken.'
              : 'Not started yet.'}
          </p>
        )}
      </section>

      <section
        aria-labelledby="next-heading"
        className="mt-3 rounded-xl border border-organiser-border bg-organiser-surface p-4 text-center"
      >
        <h2
          id="next-heading"
          className="text-xs font-semibold uppercase tracking-widest text-organiser-muted"
        >
          Up next
        </h2>
        {upNext ? (
          <>
            <p className="mt-1 text-xl font-medium">{upNext.name}</p>
            <MemberList names={members[upNext.id] ?? []} />
          </>
        ) : (
          <p className="mt-1 text-organiser-muted">Nothing left in the queue.</p>
        )}
      </section>

      {/* Large targets: this is used one-handed, outdoors, by someone also holding a
          drink and a bouquet. */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(['previous', 'call-next', 'complete', 'skip'] as const).map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => run(action)}
            disabled={pending || disabled[action]}
            data-action={action}
            className={
              action === 'call-next'
                ? 'rounded-lg bg-organiser-accent px-4 py-4 text-base font-semibold text-white disabled:opacity-50'
                : 'rounded-lg border border-organiser-border bg-organiser-surface px-4 py-4 text-base font-medium disabled:opacity-50'
            }
          >
            {ACTION_LABELS[action]}
          </button>
        ))}
      </div>

      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-center text-sm">
        {message}
      </p>

      {unreachable > 0 ? (
        // Worth acting on rather than announcing once and losing: these are the guests
        // someone now has to go and find.
        <p className="mt-1 text-center text-sm text-status-declined">
          {unreachable} {unreachable === 1 ? 'guest has' : 'guests have'} no way to be messaged. You
          will need to call them over yourself.
        </p>
      ) : null}

      <section aria-labelledby="remaining-heading" className="mt-6">
        <h2 id="remaining-heading" className="text-sm font-semibold">
          The full run
        </h2>
        <ol className="mt-2 divide-y divide-organiser-border overflow-hidden rounded-lg border border-organiser-border bg-organiser-surface">
          {groups.map((group) => (
            <li
              key={group.id}
              data-queue-status={group.status}
              className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
            >
              <span
                className={
                  group.status === 'completed' || group.status === 'skipped'
                    ? 'text-organiser-muted line-through'
                    : ''
                }
              >
                {group.name}
              </span>
              <span className="text-xs uppercase tracking-wide text-organiser-muted">
                {statusLabel(group.status)}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

/** Deliberately plain: an organiser mid-run should not have to interpret a count. */
function describeAlerts(alerts: AlertSummary): string {
  if (alerts.queued === 0 && alerts.unreachable === 0) return ''
  if (alerts.queued === 0) return 'Nobody could be messaged.'

  const told = `${alerts.queued} ${alerts.queued === 1 ? 'guest' : 'guests'} messaged.`
  return alerts.unreachable === 0 ? told : `${told} ${alerts.unreachable} could not be.`
}

function MemberList({ names }: { names: string[] }) {
  if (names.length === 0) return null
  return <p className="mt-2 text-sm text-organiser-muted">{names.join(', ')}</p>
}

function statusLabel(status: string): string {
  if (status === 'get_ready') return 'Up next'
  if (status === 'now') return 'Now'
  if (status === 'completed') return 'Done'
  if (status === 'skipped') return 'Skipped'
  return 'Waiting'
}
