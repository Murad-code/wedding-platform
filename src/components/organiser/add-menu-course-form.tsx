'use client'

import { useActionState } from 'react'

import { addCourse, type MenuState } from '@/app/(organiser)/dashboard/menu/actions'
import { cn } from '@/lib/cn'

const initial: MenuState = {}

export function AddMenuCourseForm({
  nextOrder,
  className,
}: {
  nextOrder: number
  className?: string
}) {
  const [state, formAction, pending] = useActionState(addCourse, initial)

  return (
    <form
      action={formAction}
      className={cn(
        'rounded-lg border border-organiser-border bg-organiser-surface p-4',
        className,
      )}
    >
      <h2 className="text-sm font-semibold">Add a course</h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="course-name" className="block text-sm font-medium">
            Course name
          </label>
          <input
            id="course-name"
            name="name"
            required
            maxLength={120}
            placeholder="Starter"
            className="w-full rounded-md border border-organiser-border bg-organiser-bg px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="course-order" className="block text-sm font-medium">
            Order
          </label>
          <input
            id="course-order"
            name="order"
            type="number"
            min={0}
            defaultValue={nextOrder}
            className="w-full rounded-md border border-organiser-border bg-organiser-bg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <input id="course-required" type="checkbox" name="required" defaultChecked />
          <label htmlFor="course-required">Guests must choose from this course</label>
        </div>
        <div className="flex items-center gap-2">
          <input id="course-children" type="checkbox" name="childrenOnly" />
          <label htmlFor="course-children">Children only</label>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-md bg-organiser-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? 'Adding…' : 'Add course'}
      </button>

      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-status-declined">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
