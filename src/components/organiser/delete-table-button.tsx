'use client'

import { useActionState } from 'react'

import { deleteTable, type SeatingState } from '@/app/(organiser)/dashboard/seating/actions'

const initial: SeatingState = {}

export function DeleteTableButton({ id, name }: { id: number; name: string }) {
  const [, formAction, pending] = useActionState(deleteTable, initial)

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-organiser-border px-2 py-1 text-xs text-status-declined hover:bg-status-declined/10 disabled:opacity-60"
      >
        Remove<span className="sr-only"> {name}</span>
      </button>
    </form>
  )
}
