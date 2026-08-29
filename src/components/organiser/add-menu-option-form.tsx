'use client'

import { useActionState } from 'react'

import { addOption, type MenuState } from '@/app/(organiser)/dashboard/menu/actions'
import { cn } from '@/lib/cn'

const initial: MenuState = {}

export function AddMenuOptionForm({
  courseId,
  courseName,
  className,
}: {
  courseId: number
  courseName: string
  className?: string
}) {
  const [state, formAction, pending] = useActionState(addOption, initial)

  return (
    <form action={formAction} className={cn('flex flex-wrap items-end gap-2', className)}>
      <input type="hidden" name="courseId" value={courseId} />

      <div className="min-w-48 flex-1 space-y-1.5">
        <label htmlFor={`option-name-${courseId}`} className="block text-xs font-medium">
          Add an option to {courseName}
        </label>
        <input
          id={`option-name-${courseId}`}
          name="name"
          required
          maxLength={160}
          className="w-full rounded-md border border-organiser-border bg-organiser-bg px-3 py-2 text-sm"
        />
      </div>

      <div className="flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1.5">
          <input id={`veg-${courseId}`} type="checkbox" name="isVegetarian" />
          <label htmlFor={`veg-${courseId}`}>Veggie</label>
        </span>
        <span className="flex items-center gap-1.5">
          <input id={`vegan-${courseId}`} type="checkbox" name="isVegan" />
          <label htmlFor={`vegan-${courseId}`}>Vegan</label>
        </span>
        <span className="flex items-center gap-1.5">
          <input id={`gf-${courseId}`} type="checkbox" name="isGlutenFree" />
          <label htmlFor={`gf-${courseId}`}>GF</label>
        </span>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-organiser-border px-3 py-2 text-sm font-medium hover:bg-organiser-bg disabled:opacity-60"
      >
        {pending ? 'Adding…' : 'Add'}
      </button>

      {state.error ? (
        <p role="alert" className="w-full text-sm text-status-declined">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
