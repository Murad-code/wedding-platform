'use client'

import type { ConnectionState } from './use-photo-queue'

const LABELS: Record<ConnectionState, string> = {
  connecting: 'Connecting…',
  live: 'Live',
  reconnecting: 'Reconnecting…',
  polling: 'Live (slow connection)',
}

/**
 * The connection state, stated plainly.
 *
 * A queue that has silently stopped updating is worse than one that admits it, because a
 * guest trusts what the screen says and misses their photograph (docs/UX.md §4.2).
 */
export function ConnectionBadge({
  state,
  className,
}: {
  state: ConnectionState
  className?: string
}) {
  return (
    <p
      data-connection={state}
      // Announced on change: a screen-reader user has no other way to learn the page has
      // stopped keeping up.
      role="status"
      aria-live="polite"
      className={className ?? 'text-xs font-medium text-organiser-muted'}
    >
      {LABELS[state]}
    </p>
  )
}
