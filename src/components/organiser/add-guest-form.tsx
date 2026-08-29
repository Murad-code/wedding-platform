'use client'

import { useActionState } from 'react'

import { addGuest, type ActionState } from '@/app/(organiser)/dashboard/parties/actions'
import { AGE_GROUPS } from '@/domain/guests/guest'
import { cn } from '@/lib/cn'

const initial: ActionState = {}

export function AddGuestForm({ partyId, className }: { partyId: number; className?: string }) {
  const [state, formAction, pending] = useActionState(addGuest, initial)

  return (
    <form
      action={formAction}
      className={cn(
        'rounded-lg border border-organiser-border bg-organiser-surface p-4',
        className,
      )}
    >
      <input type="hidden" name="partyId" value={partyId} />

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-40 flex-1 space-y-1.5">
          <label htmlFor="firstName" className="block text-sm font-medium">
            First name
          </label>
          <input
            id="firstName"
            name="firstName"
            required
            maxLength={100}
            className="w-full rounded-md border border-organiser-border bg-organiser-bg px-3 py-2 text-sm"
          />
        </div>

        <div className="min-w-40 flex-1 space-y-1.5">
          <label htmlFor="lastName" className="block text-sm font-medium">
            Last name
          </label>
          <input
            id="lastName"
            name="lastName"
            maxLength={100}
            className="w-full rounded-md border border-organiser-border bg-organiser-bg px-3 py-2 text-sm"
          />
        </div>

        <div className="w-32 space-y-1.5">
          <label htmlFor="ageGroup" className="block text-sm font-medium">
            Age group
          </label>
          <select
            id="ageGroup"
            name="ageGroup"
            defaultValue="adult"
            className="w-full rounded-md border border-organiser-border bg-organiser-bg px-3 py-2 text-sm"
          >
            {AGE_GROUPS.map((group) => (
              <option key={group} value={group}>
                {group.charAt(0).toUpperCase() + group.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-organiser-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? 'Adding…' : 'Add guest'}
        </button>
      </div>

      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-status-declined">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
