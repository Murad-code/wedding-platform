'use client'

import { useActionState } from 'react'

import { addPhotoGroup, type PhotoGroupState } from '@/app/(organiser)/dashboard/photos/actions'
import { cn } from '@/lib/cn'

const initial: PhotoGroupState = {}

export function AddPhotoGroupForm({ className }: { className?: string }) {
  const [state, formAction, pending] = useActionState(addPhotoGroup, initial)

  return (
    <form
      action={formAction}
      className={cn(
        'rounded-lg border border-organiser-border bg-organiser-surface p-4',
        className,
      )}
    >
      <h2 className="text-sm font-semibold">Add a photograph</h2>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1 space-y-1.5">
          <label htmlFor="group-name" className="block text-sm font-medium">
            What the photographer will call out
          </label>
          <input
            id="group-name"
            name="name"
            required
            maxLength={120}
            placeholder="Bride’s immediate family"
            className="w-full rounded-md border border-organiser-border bg-organiser-bg px-3 py-2 text-sm"
          />
        </div>

        <div className="min-w-56 flex-1 space-y-1.5">
          <label htmlFor="group-description" className="block text-sm font-medium">
            Note <span className="font-normal text-organiser-muted">(optional)</span>
          </label>
          <input
            id="group-description"
            name="description"
            maxLength={500}
            placeholder="On the terrace steps"
            className="w-full rounded-md border border-organiser-border bg-organiser-bg px-3 py-2 text-sm"
          />
        </div>

        <div className="w-32 space-y-1.5">
          <label htmlFor="group-minutes" className="block text-sm font-medium">
            Minutes
          </label>
          <input
            id="group-minutes"
            name="estimatedMinutes"
            type="number"
            min={1}
            max={120}
            placeholder="5"
            className="w-full rounded-md border border-organiser-border bg-organiser-bg px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-organiser-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? 'Adding…' : 'Add photograph'}
        </button>
      </div>

      <p className="mt-2 text-xs text-organiser-muted">
        Minutes are only an estimate. Guests use them to judge when to start heading over.
      </p>

      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-status-declined">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
