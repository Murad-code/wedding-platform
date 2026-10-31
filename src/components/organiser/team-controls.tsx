'use client'

import { useActionState } from 'react'

import {
  addTeamMember,
  changeTeamMemberRole,
  removeTeamMember,
  setTeamMemberPassword,
  type TeamState,
} from '@/app/(organiser)/dashboard/team/actions'
import { ROLES, type Role } from '@/domain/auth/roles'
import { MIN_PASSWORD_LENGTH } from '@/domain/auth/team'
import { cn } from '@/lib/cn'

const initial: TeamState = {}

const input = 'w-full rounded-md border border-organiser-border bg-organiser-bg px-3 py-2 text-sm'
const smallButton =
  'rounded-md border border-organiser-border px-2.5 py-1.5 text-xs font-medium hover:bg-organiser-bg disabled:opacity-60'

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  organiser: 'Organiser',
  viewer: 'Viewer',
}

function Feedback({ state }: { state: TeamState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-xs text-status-declined">
        {state.error}
      </p>
    )
  }
  if (state.message) {
    return (
      <p role="status" className="text-xs text-organiser-muted">
        {state.message}
      </p>
    )
  }
  return null
}

export function AddTeamMemberForm({ className }: { className?: string }) {
  const [state, formAction, pending] = useActionState(addTeamMember, initial)

  return (
    <form
      action={formAction}
      className={cn(
        'rounded-lg border border-organiser-border bg-organiser-surface p-4',
        className,
      )}
    >
      <h2 className="text-sm font-semibold">Add someone</h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="member-name" className="block text-sm font-medium">
            Name
          </label>
          <input id="member-name" name="name" required maxLength={100} className={input} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="member-email" className="block text-sm font-medium">
            Email
          </label>
          <input id="member-email" name="email" type="email" required className={input} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="member-role" className="block text-sm font-medium">
            Role
          </label>
          <select id="member-role" name="role" defaultValue="organiser" className={input}>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="member-password" className="block text-sm font-medium">
            Starting password
          </label>
          <input
            id="member-password"
            name="password"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            className={input}
          />
        </div>
      </div>

      <p className="mt-2 text-xs text-organiser-muted">
        Give them this password privately. They can change it from their account page once they have
        signed in.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-organiser-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? 'Adding…' : 'Add to the team'}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  )
}

export function ChangeRoleForm({ id, name, role }: { id: number; name: string; role: Role }) {
  const [state, formAction, pending] = useActionState(changeTeamMemberRole, initial)
  const fieldId = `role-${id}`

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <label htmlFor={fieldId} className="sr-only">
        Role for {name}
      </label>
      <select
        id={fieldId}
        name="role"
        defaultValue={role}
        className="rounded-md border border-organiser-border bg-organiser-bg px-2 py-1.5 text-sm"
      >
        {ROLES.map((option) => (
          <option key={option} value={option}>
            {ROLE_LABELS[option]}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} className={smallButton}>
        {pending ? 'Saving…' : 'Save'}
        <span className="sr-only"> role for {name}</span>
      </button>
      <Feedback state={state} />
    </form>
  )
}

export function SetPasswordForm({ id, name }: { id: number; name: string }) {
  const [state, formAction, pending] = useActionState(setTeamMemberPassword, initial)
  const fieldId = `password-${id}`

  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-xs text-organiser-muted">
        Set a new password<span className="sr-only"> for {name}</span>
      </summary>
      <form action={formAction} className="mt-2 flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={id} />
        <label htmlFor={fieldId} className="sr-only">
          New password for {name}
        </label>
        <input
          id={fieldId}
          name="password"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          className="rounded-md border border-organiser-border bg-organiser-bg px-2 py-1.5 text-sm"
        />
        <button type="submit" disabled={pending} className={smallButton}>
          {pending ? 'Setting…' : 'Set password'}
        </button>
        <Feedback state={state} />
      </form>
    </details>
  )
}

export function RemoveTeamMemberButton({ id, name }: { id: number; name: string }) {
  const [state, formAction, pending] = useActionState(removeTeamMember, initial)

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-organiser-border px-2.5 py-1.5 text-xs text-status-declined hover:bg-status-declined/10 disabled:opacity-60"
      >
        Remove<span className="sr-only"> {name}</span>
      </button>
      <Feedback state={state} />
    </form>
  )
}
