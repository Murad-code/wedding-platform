'use client'

import { useActionState } from 'react'

import {
  deleteItineraryItem,
  type ItineraryState,
} from '@/app/(organiser)/dashboard/itinerary/actions'

const initial: ItineraryState = {}

export function DeleteItineraryItemButton({ id, title }: { id: number; title: string }) {
  const [, formAction, pending] = useActionState(deleteItineraryItem, initial)

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-organiser-border px-2 py-1 text-xs text-status-declined hover:bg-status-declined/10 disabled:opacity-60"
      >
        Remove<span className="sr-only"> {title}</span>
      </button>
    </form>
  )
}
