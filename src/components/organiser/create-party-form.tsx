'use client'

import { useActionState } from 'react'

import { createParty, type ActionState } from '@/app/(organiser)/dashboard/parties/actions'
import { cn } from '@/lib/cn'

const initial: ActionState = {}

export function CreatePartyForm({ className }: { className?: string }) {
  const [state, formAction, pending] = useActionState(createParty, initial)

  return (
    <form
      action={formAction}
      className={cn(
        'rounded-lg border border-organiser-border bg-organiser-surface p-4',
        className,
      )}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1 space-y-1.5">
          <label htmlFor="displayName" className="block text-sm font-medium">
            Party name
          </label>
          <input
            id="displayName"
            name="displayName"
            required
            maxLength={200}
            placeholder="The Kamali Family"
            className="w-full rounded-md border border-organiser-border bg-organiser-bg px-3 py-2 text-sm"
          />
        </div>

        <div className="w-32 space-y-1.5">
          <label htmlFor="plusOnesAllowed" className="block text-sm font-medium">
            Plus ones
          </label>
          <input
            id="plusOnesAllowed"
            name="plusOnesAllowed"
            type="number"
            min={0}
            max={10}
            defaultValue={0}
            className="w-full rounded-md border border-organiser-border bg-organiser-bg px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-organiser-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? 'Adding…' : 'Add party'}
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
