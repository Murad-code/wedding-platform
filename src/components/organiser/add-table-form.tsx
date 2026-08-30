'use client'

import { useActionState } from 'react'

import { addTable, type SeatingState } from '@/app/(organiser)/dashboard/seating/actions'
import { TABLE_SHAPES } from '@/domain/seating/seating'
import { cn } from '@/lib/cn'

const initial: SeatingState = {}

export function AddTableForm({ nextOrder, className }: { nextOrder: number; className?: string }) {
  const [state, formAction, pending] = useActionState(addTable, initial)

  return (
    <form
      action={formAction}
      className={cn(
        'rounded-lg border border-organiser-border bg-organiser-surface p-4',
        className,
      )}
    >
      <h3 className="text-sm font-semibold">Add a table</h3>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="min-w-40 flex-1 space-y-1.5">
          <label htmlFor="table-name" className="block text-sm font-medium">
            Table name
          </label>
          <input
            id="table-name"
            name="name"
            required
            maxLength={120}
            placeholder="Top table"
            className="w-full rounded-md border border-organiser-border bg-organiser-bg px-3 py-2 text-sm"
          />
        </div>

        <div className="w-28 space-y-1.5">
          <label htmlFor="table-capacity" className="block text-sm font-medium">
            Seats
          </label>
          <input
            id="table-capacity"
            name="capacity"
            type="number"
            min={1}
            max={100}
            defaultValue={8}
            className="w-full rounded-md border border-organiser-border bg-organiser-bg px-3 py-2 text-sm"
          />
        </div>

        <div className="w-36 space-y-1.5">
          <label htmlFor="table-shape" className="block text-sm font-medium">
            Shape
          </label>
          <select
            id="table-shape"
            name="shape"
            defaultValue="round"
            className="w-full rounded-md border border-organiser-border bg-organiser-bg px-3 py-2 text-sm"
          >
            {TABLE_SHAPES.map((shape) => (
              <option key={shape} value={shape}>
                {shape.charAt(0).toUpperCase() + shape.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <input type="hidden" name="order" value={nextOrder} />

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-organiser-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? 'Adding…' : 'Add table'}
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
