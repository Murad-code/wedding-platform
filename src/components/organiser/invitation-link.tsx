'use client'

import { useActionState } from 'react'

import { issueInvitation, type ActionState } from '@/app/(organiser)/dashboard/parties/actions'
import { cn } from '@/lib/cn'

import { InvitationQrCode } from './invitation-qr-code'

const initial: ActionState & { token?: string } = {}

export function InvitationLink({
  partyId,
  partyName,
  hasInvitation,
  className,
}: {
  partyId: number
  partyName: string
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
          <p className="text-sm font-medium">
            Copy this link, or download the QR code, now. They are shown only once.
          </p>
          <code
            data-testid="invitation-url"
            className="mt-2 block break-all rounded-md bg-organiser-surface px-3 py-2 font-mono text-xs"
          >
            {url}
          </code>
          <div className="mt-4">
            <InvitationQrCode url={url} partyName={partyName} />
          </div>
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
        {hasInvitation || url ? (
          <p className="mt-2 text-xs text-organiser-muted">
            A new link stops the old one working, including any QR code already printed on their
            invitation.
          </p>
        ) : null}
      </form>

      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-status-declined">
          {state.error}
        </p>
      ) : null}
    </div>
  )
}
