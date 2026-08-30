'use client'

import { useActionState } from 'react'

import { issueInvitation, type ActionState } from '@/app/(organiser)/dashboard/parties/actions'
import { cn } from '@/lib/cn'

const initial: ActionState & { token?: string } = {}

export function InvitationLink({
  partyId,
  hasInvitation,
  className,
}: {
  partyId: number
  hasInvitation: boolean
  className?: string
}) {
  const [state, formAction, pending] = useActionState(issueInvitation, initial)

  // The raw token exists only in this response — it is never stored, so it cannot be
  // shown again after a reload (ADR-005).
  const url = state.token
    ? `${typeof window === 'undefined' ? '' : window.location.origin}/invite/${state.token}`
    : null

  return (
    <div className={className}>
      {url ? (
        <div className="rounded-lg border border-status-attending/40 bg-status-attending/5 p-4">
          <p className="text-sm font-medium">Copy this link now. It is shown only once.</p>
          <code
            data-testid="invitation-url"
            className="mt-2 block break-all rounded-md bg-organiser-surface px-3 py-2 font-mono text-xs"
          >
            {url}
          </code>
        </div>
      ) : null}

      <form action={formAction} className={cn(url && 'mt-3')}>
        <input type="hidden" name="partyId" value={partyId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-organiser-border px-4 py-2 text-sm font-medium hover:bg-organiser-surface disabled:opacity-60"
        >
          {pending
            ? 'Creating…'
            : hasInvitation || url
              ? 'Create a new link (replaces the old one)'
              : 'Create invitation link'}
        </button>
      </form>

      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-status-declined">
          {state.error}
        </p>
      ) : null}
    </div>
  )
}
