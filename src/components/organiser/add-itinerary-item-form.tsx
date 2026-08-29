'use client'

import { useActionState } from 'react'

import {
  addItineraryItem,
  type ItineraryState,
} from '@/app/(organiser)/dashboard/itinerary/actions'
import { cn } from '@/lib/cn'

const initial: ItineraryState = {}

export function AddItineraryItemForm({
  nextOrder,
  className,
}: {
  nextOrder: number
  className?: string
}) {
  const [state, formAction, pending] = useActionState(addItineraryItem, initial)

  return (
    <form
      action={formAction}
      className={cn(
        'rounded-lg border border-organiser-border bg-organiser-surface p-4',
        className,
      )}
    >
      <h2 className="text-sm font-semibold">Add a moment</h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="title" className="block text-sm font-medium">
            What is happening
          </label>
          <input
            id="title"
            name="title"
            required
            maxLength={200}
            placeholder="Guest arrival"
            className="w-full rounded-md border border-organiser-border bg-organiser-bg px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="startTime" className="block text-sm font-medium">
            Start time
          </label>
          <input
            id="startTime"
            name="startTime"
            type="datetime-local"
            className="w-full rounded-md border border-organiser-border bg-organiser-bg px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="location" className="block text-sm font-medium">
            Where
          </label>
          <input
            id="location"
            name="location"
            maxLength={200}
            className="w-full rounded-md border border-organiser-border bg-organiser-bg px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="visibility" className="block text-sm font-medium">
            Who can see it
          </label>
          <select
            id="visibility"
            name="visibility"
            defaultValue="guests"
            className="w-full rounded-md border border-organiser-border bg-organiser-bg px-3 py-2 text-sm"
          >
            <option value="public">Everyone</option>
            <option value="guests">Invited guests</option>
            <option value="internal">Internal only</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="order" className="block text-sm font-medium">
            Order
          </label>
          <input
            id="order"
            name="order"
            type="number"
            min={0}
            defaultValue={nextOrder}
            className="w-full rounded-md border border-organiser-border bg-organiser-bg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-md bg-organiser-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? 'Adding…' : 'Add to the day'}
      </button>

      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-status-declined">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
