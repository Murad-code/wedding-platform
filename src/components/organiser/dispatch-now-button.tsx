'use client'

import { useActionState } from 'react'

import { dispatchNow, type DispatchState } from '@/app/(organiser)/dashboard/notifications/actions'

const initial: DispatchState = {}

export function DispatchNowButton() {
  const [state, formAction, pending] = useActionState(dispatchNow, initial)

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-organiser-border px-3 py-1.5 text-sm font-medium hover:bg-organiser-surface disabled:opacity-60"
      >
        {pending ? 'Sending…' : 'Try sending now'}
      </button>

      {state.message ? (
        <p role="status" className="text-sm text-organiser-muted">
          {state.message}
        </p>
      ) : null}
    </form>
  )
}
