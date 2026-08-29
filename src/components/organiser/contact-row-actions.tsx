'use client'

import { useActionState } from 'react'

import {
  deleteContact,
  toggleContactVisibility,
  type ContactState,
} from '@/app/(organiser)/dashboard/contacts/actions'

const initial: ContactState = {}

export function ContactRowActions({
  id,
  name,
  visible,
}: {
  id: number
  name: string
  visible: boolean
}) {
  const [, toggleAction, toggling] = useActionState(toggleContactVisibility, initial)
  const [, deleteAction, deleting] = useActionState(deleteContact, initial)

  return (
    <div className="flex items-center gap-2">
      <form action={toggleAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="visible" value={visible ? 'false' : 'true'} />
        <button
          type="submit"
          disabled={toggling}
          className="rounded-md border border-organiser-border px-2 py-1 text-xs hover:bg-organiser-bg disabled:opacity-60"
        >
          {visible ? 'Hide' : 'Show'}
          <span className="sr-only"> {name} on the guest website</span>
        </button>
      </form>

      <form action={deleteAction}>
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          disabled={deleting}
          className="rounded-md border border-organiser-border px-2 py-1 text-xs text-status-declined hover:bg-status-declined/10 disabled:opacity-60"
        >
          Remove<span className="sr-only"> {name}</span>
        </button>
      </form>
    </div>
  )
}
