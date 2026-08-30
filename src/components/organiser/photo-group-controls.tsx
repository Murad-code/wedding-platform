'use client'

import { useActionState } from 'react'

import {
  addGroupMember,
  deletePhotoGroup,
  movePhotoGroup,
  removeGroupMember,
  type PhotoGroupState,
} from '@/app/(organiser)/dashboard/photos/actions'
import type { PhotographableGuest } from '@/lib/photo-queue'

const initial: PhotoGroupState = {}

const smallButton =
  'rounded-md border border-organiser-border px-2 py-1 text-xs font-medium hover:bg-organiser-bg disabled:opacity-60'

export function MovePhotoGroupButton({
  id,
  name,
  direction,
  disabled,
}: {
  id: number
  name: string
  direction: 'up' | 'down'
  disabled: boolean
}) {
  const [, formAction, pending] = useActionState(movePhotoGroup, initial)

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="direction" value={direction} />
      <button type="submit" disabled={disabled || pending} className={smallButton}>
        <span aria-hidden="true">{direction === 'up' ? '↑' : '↓'}</span>
        {/* The arrow alone tells a screen reader nothing about what moves where. */}
        <span className="sr-only">
          Move {name} {direction === 'up' ? 'earlier' : 'later'}
        </span>
      </button>
    </form>
  )
}

export function DeletePhotoGroupButton({ id, name }: { id: number; name: string }) {
  const [, formAction, pending] = useActionState(deletePhotoGroup, initial)

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-organiser-border px-2 py-1 text-xs text-status-declined hover:bg-status-declined/10 disabled:opacity-60"
      >
        Remove<span className="sr-only"> the photograph {name}</span>
      </button>
    </form>
  )
}

export function RemoveMemberButton({
  groupId,
  groupName,
  guestId,
  guestName,
}: {
  groupId: number
  groupName: string
  guestId: number
  guestName: string
}) {
  const [, formAction, pending] = useActionState(removeGroupMember, initial)

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="guestId" value={guestId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border border-organiser-border px-1.5 text-xs text-organiser-muted hover:text-status-declined disabled:opacity-60"
      >
        <span aria-hidden="true">×</span>
        <span className="sr-only">
          Take {guestName} out of {groupName}
        </span>
      </button>
    </form>
  )
}

export function AddMemberForm({
  groupId,
  groupName,
  candidates,
}: {
  groupId: number
  groupName: string
  candidates: PhotographableGuest[]
}) {
  const [state, formAction, pending] = useActionState(addGroupMember, initial)
  const fieldId = `add-member-${groupId}`

  if (candidates.length === 0) {
    return (
      <p className="text-xs text-organiser-muted">Everyone attending is already in this photo.</p>
    )
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="groupId" value={groupId} />

      <div className="min-w-52 flex-1 space-y-1">
        <label htmlFor={fieldId} className="block text-xs font-medium text-organiser-muted">
          Add someone to {groupName}
        </label>
        <select
          id={fieldId}
          name="guestId"
          defaultValue=""
          required
          className="w-full rounded-md border border-organiser-border bg-organiser-bg px-2 py-1.5 text-sm"
        >
          <option value="" disabled>
            Choose a guest…
          </option>
          {candidates.map((guest) => (
            <option key={guest.id} value={guest.id}>
              {guest.displayName}
              {guest.partyName ? ` — ${guest.partyName}` : ''}
            </option>
          ))}
        </select>
      </div>

      <button type="submit" disabled={pending} className={smallButton}>
        {pending ? 'Adding…' : 'Add'}
      </button>

      {state.error ? (
        <p role="alert" className="w-full text-xs text-status-declined">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
