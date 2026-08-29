'use client'

import { useActionState } from 'react'

import {
  deleteCourse,
  deleteOption,
  type MenuState,
} from '@/app/(organiser)/dashboard/menu/actions'

const initial: MenuState = {}

export function DeleteMenuItemButton({
  kind,
  id,
  label,
}: {
  kind: 'course' | 'option'
  id: number
  label: string
}) {
  const [, formAction, pending] = useActionState(
    kind === 'course' ? deleteCourse : deleteOption,
    initial,
  )

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-organiser-border px-2 py-1 text-xs text-status-declined hover:bg-status-declined/10 disabled:opacity-60"
      >
        Remove<span className="sr-only"> {label}</span>
      </button>
    </form>
  )
}
